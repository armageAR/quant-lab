import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { ExecutableOpportunityService } from '@quant-lab/market-ingestion';
import type {
  ExecutableDetectorConfig,
  InventoryConfig,
} from '@quant-lab/strategy-engine';

import { EXECUTABLE_OPPORTUNITIES } from './tokens';

const CLASSIFICATIONS = ['executable', 'missed', 'observed', 'rejected'];

function isDecimalString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    Number.isFinite(Number(value))
  );
}

function parseInventory(value: unknown): InventoryConfig {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new BadRequestException('inventory must be an object');
  const inventory: Record<string, Record<string, string>> = {};
  for (const [venue, balances] of Object.entries(value)) {
    if (typeof balances !== 'object' || balances === null)
      throw new BadRequestException('inventory balances must be an object');
    const venueBalances: Record<string, string> = {};
    for (const [currency, amount] of Object.entries(
      balances as Record<string, unknown>,
    )) {
      if (!isDecimalString(amount))
        throw new BadRequestException('inventory amounts must be decimals');
      venueBalances[currency] = amount;
    }
    inventory[venue] = venueBalances;
  }
  return inventory;
}

@Controller('executable-opportunities')
export class ExecutableOpportunitiesController {
  constructor(
    @Inject(EXECUTABLE_OPPORTUNITIES)
    private readonly opportunities: ExecutableOpportunityService,
  ) {}

  @Post('evaluate')
  evaluate(@Body() body: Partial<ExecutableDetectorConfig>) {
    const tradeSizes = body.tradeSizes ?? ['0.01', '0.1', '1'];
    const config: ExecutableDetectorConfig = {
      id: body.id ?? 'cross-venue-executable',
      version: body.version ?? '1.0.0',
      maximumBookAgeMs: body.maximumBookAgeMs ?? 5_000,
      maximumCrossVenueSkewMs: body.maximumCrossVenueSkewMs ?? 1_000,
      tradeSizes,
      slippageBufferRate: body.slippageBufferRate ?? '0.0005',
      latencyBufferMs: body.latencyBufferMs ?? 250,
      minimumNetProfitRate: body.minimumNetProfitRate ?? '0',
      inventory: parseInventory(body.inventory),
    };
    if (
      !config.id ||
      !config.version ||
      typeof config.maximumBookAgeMs !== 'number' ||
      !Number.isFinite(config.maximumBookAgeMs) ||
      config.maximumBookAgeMs < 1 ||
      typeof config.maximumCrossVenueSkewMs !== 'number' ||
      !Number.isFinite(config.maximumCrossVenueSkewMs) ||
      config.maximumCrossVenueSkewMs < 0 ||
      typeof config.latencyBufferMs !== 'number' ||
      !Number.isFinite(config.latencyBufferMs) ||
      config.latencyBufferMs < 0 ||
      !Array.isArray(config.tradeSizes) ||
      config.tradeSizes.length === 0 ||
      !config.tradeSizes.every(isDecimalString) ||
      !isDecimalString(config.slippageBufferRate) ||
      Number(config.slippageBufferRate) < 0 ||
      !isDecimalString(config.minimumNetProfitRate)
    )
      throw new BadRequestException('detector configuration is invalid');
    return this.opportunities.evaluateAll(config);
  }

  @Get()
  query(
    @Query('canonicalSymbol') canonicalSymbol?: string,
    @Query('classification') classification?: string,
    @Query('rejectionReason') rejectionReason?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    if (classification && !CLASSIFICATIONS.includes(classification))
      throw new BadRequestException(
        'classification must be executable, missed, observed, or rejected',
      );
    const parsed = limit === undefined ? 100 : Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500)
      throw new BadRequestException('limit must be between 1 and 500');
    return this.opportunities.query({
      ...(canonicalSymbol ? { canonicalSymbol } : {}),
      ...(classification
        ? {
            classification: classification as
              'executable' | 'missed' | 'observed' | 'rejected',
          }
        : {}),
      ...(rejectionReason ? { rejectionReason } : {}),
      limit: parsed,
      ...(cursor ? { cursor } : {}),
    });
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { ObservedOpportunityService } from '@quant-lab/market-ingestion';
import type { ObservedDetectorConfig } from '@quant-lab/strategy-engine';

import { OPPORTUNITIES } from './tokens';

@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    @Inject(OPPORTUNITIES)
    private readonly opportunities: ObservedOpportunityService,
  ) {}

  @Post('evaluate')
  evaluate(@Body() body: Partial<ObservedDetectorConfig>) {
    const config: ObservedDetectorConfig = {
      id: body.id ?? 'cross-venue-observed',
      version: body.version ?? '1.0.0',
      maximumBookAgeMs: body.maximumBookAgeMs ?? 5_000,
      maximumCrossVenueSkewMs: body.maximumCrossVenueSkewMs ?? 1_000,
      minimumObservedSpread: body.minimumObservedSpread ?? '0',
    };
    if (
      !config.id ||
      !config.version ||
      typeof config.minimumObservedSpread !== 'string'
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
    if (
      classification &&
      classification !== 'observed' &&
      classification !== 'rejected'
    )
      throw new BadRequestException(
        'classification must be observed or rejected',
      );
    const parsed = limit === undefined ? 100 : Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500)
      throw new BadRequestException('limit must be between 1 and 500');
    return this.opportunities.query({
      ...(canonicalSymbol ? { canonicalSymbol } : {}),
      ...(classification
        ? { classification: classification as 'observed' | 'rejected' }
        : {}),
      ...(rejectionReason ? { rejectionReason } : {}),
      limit: parsed,
      ...(cursor ? { cursor } : {}),
    });
  }
}

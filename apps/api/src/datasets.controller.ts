import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { HistoricalDatasetService } from '@quant-lab/market-ingestion';

import { DATASETS } from './tokens';

interface CreateDatasetBody {
  marketIds?: string[];
  from?: string;
  to?: string;
  schemaVersion?: string;
}

@Controller('datasets')
export class DatasetsController {
  constructor(
    @Inject(DATASETS) private readonly datasets: HistoricalDatasetService,
  ) {}

  @Post()
  create(@Body() body: CreateDatasetBody) {
    if (!Array.isArray(body.marketIds) || body.marketIds.length === 0)
      throw new BadRequestException('marketIds is required');
    return this.datasets.create({
      marketIds: body.marketIds,
      from: this.date(body.from, 'from'),
      to: this.date(body.to, 'to'),
      ...(body.schemaVersion ? { schemaVersion: body.schemaVersion } : {}),
    });
  }

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('marketId') marketId?: string,
    @Query('pinned') pinned?: string,
    @Query('validated') validated?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const parsedLimit = limit === undefined ? 100 : Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200)
      throw new BadRequestException('limit must be between 1 and 200');
    return this.datasets.list({
      limit: parsedLimit,
      ...(cursor ? { cursor } : {}),
      ...(marketId ? { marketId } : {}),
      ...(pinned === undefined
        ? {}
        : { pinned: this.boolean(pinned, 'pinned') }),
      ...(validated === undefined
        ? {}
        : { validated: this.boolean(validated, 'validated') }),
      ...(from === undefined ? {} : { from: this.optionalDate(from, 'from') }),
      ...(to === undefined ? {} : { to: this.optionalDate(to, 'to') }),
    });
  }

  @Get(':id')
  inspect(@Param('id') id: string) {
    return this.datasets.inspect(id);
  }

  @Get(':id/events')
  events(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('afterOrdinal') afterOrdinal?: string,
  ) {
    const parsedLimit = limit === undefined ? 100 : Number(limit);
    const parsedOrdinal =
      afterOrdinal === undefined ? -1 : Number(afterOrdinal);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000)
      throw new BadRequestException('limit must be between 1 and 1000');
    if (!Number.isInteger(parsedOrdinal) || parsedOrdinal < -1)
      throw new BadRequestException('afterOrdinal must be an integer');
    return this.datasets.events(id, parsedLimit, parsedOrdinal);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string, @Query('maxGapMs') maxGapMs?: string) {
    const parsed = maxGapMs === undefined ? 60_000 : Number(maxGapMs);
    if (!Number.isInteger(parsed) || parsed < 1)
      throw new BadRequestException('maxGapMs must be a positive integer');
    return this.datasets.validate(id, parsed);
  }

  @Post(':id/pin')
  pin(@Param('id') id: string) {
    return this.datasets.pin(id);
  }

  @Post(':id/export')
  export(@Param('id') id: string, @Body() body: { directory?: string }) {
    return this.datasets.export(id, body.directory);
  }

  @Post(':id/compact')
  compact(@Param('id') id: string, @Body() body: { directory?: string }) {
    return this.datasets.compact(id, body.directory);
  }

  private date(value: string | undefined, field: string): Date {
    if (!value) throw new BadRequestException(`${field} is required`);
    const result = new Date(value);
    if (Number.isNaN(result.getTime()))
      throw new BadRequestException(`${field} must be an ISO timestamp`);
    return result;
  }

  private boolean(value: string, field: string): boolean {
    if (value !== 'true' && value !== 'false')
      throw new BadRequestException(`${field} must be true or false`);
    return value === 'true';
  }

  private optionalDate(value: string, field: string): Date {
    return this.date(value, field);
  }
}

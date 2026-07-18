import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Inject,
  Query,
} from '@nestjs/common';
import {
  ArbitrageResearchService,
  type ResearchQuery,
} from '@quant-lab/analytics';

import { RESEARCH } from './tokens';

@Controller('research')
export class ResearchController {
  constructor(
    @Inject(RESEARCH) private readonly research: ArbitrageResearchService,
  ) {}

  @Get('report')
  report(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('canonicalSymbol') canonicalSymbol?: string,
    @Query('datasetId') datasetId?: string,
  ) {
    return this.research.report(
      this.query(from, to, canonicalSymbol, datasetId),
    );
  }

  @Get('report.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="research-report.csv"')
  csv(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('canonicalSymbol') canonicalSymbol?: string,
    @Query('datasetId') datasetId?: string,
  ) {
    return this.research.csv(this.query(from, to, canonicalSymbol, datasetId));
  }

  private query(
    from?: string,
    to?: string,
    canonicalSymbol?: string,
    datasetId?: string,
  ): ResearchQuery {
    const fromDate = this.date(from, 'from');
    const toDate = this.date(to, 'to');
    if (fromDate && toDate && fromDate > toDate)
      throw new BadRequestException('from must not be after to');
    return {
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
      ...(canonicalSymbol ? { canonicalSymbol } : {}),
      ...(datasetId ? { datasetId } : {}),
    };
  }

  private date(value: string | undefined, field: string): Date | undefined {
    if (value === undefined) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
      throw new BadRequestException(`${field} must be an ISO-8601 date`);
    return parsed;
  }
}

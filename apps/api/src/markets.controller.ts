import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common';
import { MarketCatalog } from '@quant-lab/market-catalog';
import { MarketEventStore } from '@quant-lab/market-ingestion';

import { MARKET_CATALOG, MARKET_EVENTS } from './tokens';

@Controller('markets')
export class MarketsController {
  constructor(
    @Inject(MARKET_CATALOG) private readonly catalog: MarketCatalog,
    @Inject(MARKET_EVENTS) private readonly events: MarketEventStore,
  ) {}

  @Get('comparable')
  comparable() {
    return this.catalog.listComparableActiveMarkets();
  }

  @Get('trades')
  trades(
    @Query('marketId') marketId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('canonicalSymbol') canonicalSymbol?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!marketId && !canonicalSymbol)
      throw new BadRequestException('marketId or canonicalSymbol is required');
    const parsed = limit === undefined ? 100 : Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500)
      throw new BadRequestException('limit must be between 1 and 500');
    if (canonicalSymbol)
      return this.events.tradesByCanonical(
        canonicalSymbol,
        this.date(from, 'from'),
        this.date(to, 'to'),
        parsed,
        cursor,
      );
    return this.events.trades(this.requiredMarket(marketId), parsed, cursor);
  }

  @Get('tickers')
  tickers(
    @Query('marketId') marketId?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('canonicalSymbol') canonicalSymbol?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (canonicalSymbol)
      return this.events.tickersByCanonical(
        canonicalSymbol,
        this.date(from, 'from'),
        this.date(to, 'to'),
        this.pageLimit(limit),
        cursor,
      );
    return this.events.tickers(
      this.requiredMarket(marketId),
      this.pageLimit(limit),
      cursor,
    );
  }

  @Get('candles')
  candles(
    @Query('marketId') marketId?: string,
    @Query('interval') interval?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('canonicalSymbol') canonicalSymbol?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!interval) throw new BadRequestException('interval is required');
    if (canonicalSymbol)
      return this.events.candlesByCanonical(
        canonicalSymbol,
        interval,
        this.date(from, 'from'),
        this.date(to, 'to'),
        this.pageLimit(limit),
        cursor,
      );
    return this.events.candles(
      this.requiredMarket(marketId),
      interval,
      this.pageLimit(limit),
      cursor,
    );
  }

  @Get('order-book')
  orderBook(
    @Query('marketId') marketId?: string,
    @Query('at') at?: string,
    @Query('depth') depth?: string,
  ) {
    const parsedDepth = depth === undefined ? 100 : Number(depth);
    if (!Number.isInteger(parsedDepth) || parsedDepth < 1 || parsedDepth > 1000)
      throw new BadRequestException('depth must be between 1 and 1000');
    return this.events.reconstructOrderBook(
      this.requiredMarket(marketId),
      this.date(at, 'at') ?? new Date(),
      parsedDepth,
    );
  }

  private requiredMarket(value?: string): string {
    if (!value) throw new BadRequestException('marketId is required');
    return value;
  }
  private pageLimit(value?: string): number {
    const parsed = value === undefined ? 100 : Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500)
      throw new BadRequestException('limit must be between 1 and 500');
    return parsed;
  }
  private date(value: string | undefined, field: string): Date | undefined {
    if (value === undefined) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException(`${field} must be an ISO timestamp`);
    return date;
  }
}

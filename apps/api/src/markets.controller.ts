import { Controller, Get, Inject } from '@nestjs/common';
import { MarketCatalog } from '@quant-lab/market-catalog';

import { MARKET_CATALOG } from './tokens';

@Controller('markets')
export class MarketsController {
  constructor(
    @Inject(MARKET_CATALOG) private readonly catalog: MarketCatalog,
  ) {}

  @Get('comparable')
  comparable() {
    return this.catalog.listComparableActiveMarkets();
  }
}

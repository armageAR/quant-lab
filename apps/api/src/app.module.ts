import { DynamicModule, Module } from '@nestjs/common';
import type { DatabaseLifecycle } from '@quant-lab/database';
import { MarketCatalog } from '@quant-lab/market-catalog';
import type { ApplicationMetrics } from '@quant-lab/shared';

import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { MarketsController } from './markets.controller';
import { DATABASE, MARKET_CATALOG, METRICS } from './tokens';

@Module({})
export class AppModule {
  static register(
    database: DatabaseLifecycle,
    metrics: ApplicationMetrics,
  ): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, MetricsController, MarketsController],
      providers: [
        { provide: DATABASE, useValue: database },
        { provide: METRICS, useValue: metrics },
        {
          provide: MARKET_CATALOG,
          useValue: new MarketCatalog(database.client),
        },
      ],
    };
  }
}

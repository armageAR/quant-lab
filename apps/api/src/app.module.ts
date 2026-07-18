import { DynamicModule, Module } from '@nestjs/common';
import type { DatabaseLifecycle } from '@quant-lab/database';
import { MarketCatalog } from '@quant-lab/market-catalog';
import {
  HistoricalDatasetService,
  MarketEventStore,
  ObservedOpportunityService,
} from '@quant-lab/market-ingestion';
import type { ApplicationMetrics } from '@quant-lab/shared';

import { HealthController } from './health.controller';
import { DatasetsController } from './datasets.controller';
import { MetricsController } from './metrics.controller';
import { OpportunitiesController } from './opportunities.controller';
import { MarketsController } from './markets.controller';
import {
  DATABASE,
  DATASETS,
  MARKET_CATALOG,
  MARKET_EVENTS,
  METRICS,
  OPPORTUNITIES,
} from './tokens';

@Module({})
export class AppModule {
  static register(
    database: DatabaseLifecycle,
    metrics: ApplicationMetrics,
  ): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController,
        MetricsController,
        MarketsController,
        DatasetsController,
        OpportunitiesController,
      ],
      providers: [
        { provide: DATABASE, useValue: database },
        { provide: METRICS, useValue: metrics },
        {
          provide: MARKET_EVENTS,
          useValue: new MarketEventStore(database.client, metrics),
        },
        {
          provide: MARKET_CATALOG,
          useValue: new MarketCatalog(database.client),
        },
        {
          provide: DATASETS,
          useValue: new HistoricalDatasetService(database.client),
        },
        {
          provide: OPPORTUNITIES,
          useValue: new ObservedOpportunityService(database.client),
        },
      ],
    };
  }
}

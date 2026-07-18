import { DynamicModule, Module } from '@nestjs/common';
import {
  ArbitrageResearchService,
  BacktestAnalyticsService,
  researchReportConfigFromEnv,
} from '@quant-lab/analytics';
import type { DatabaseLifecycle } from '@quant-lab/database';
import { MarketCatalog } from '@quant-lab/market-catalog';
import {
  ExecutableOpportunityService,
  HistoricalDatasetService,
  MarketEventStore,
  ObservedOpportunityService,
} from '@quant-lab/market-ingestion';
import type { ApplicationMetrics } from '@quant-lab/shared';
import { BacktestRunService } from '@quant-lab/simulation';

import { HealthController } from './health.controller';
import { DatasetsController } from './datasets.controller';
import { MetricsController } from './metrics.controller';
import { OpportunitiesController } from './opportunities.controller';
import { ExecutableOpportunitiesController } from './executable-opportunities.controller';
import { ResearchController } from './research.controller';
import { MarketsController } from './markets.controller';
import { BacktestsController } from './backtests.controller';
import {
  DATABASE,
  DATASETS,
  EXECUTABLE_OPPORTUNITIES,
  MARKET_CATALOG,
  MARKET_EVENTS,
  METRICS,
  OPPORTUNITIES,
  RESEARCH,
  BACKTESTS,
  BACKTEST_ANALYTICS,
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
        ExecutableOpportunitiesController,
        ResearchController,
        BacktestsController,
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
        {
          provide: EXECUTABLE_OPPORTUNITIES,
          useValue: new ExecutableOpportunityService(database.client),
        },
        {
          provide: RESEARCH,
          useValue: new ArbitrageResearchService(
            database.client,
            researchReportConfigFromEnv(),
          ),
        },
        {
          provide: BACKTESTS,
          useValue: new BacktestRunService(database.client),
        },
        {
          provide: BACKTEST_ANALYTICS,
          useValue: new BacktestAnalyticsService(database.client),
        },
      ],
    };
  }
}

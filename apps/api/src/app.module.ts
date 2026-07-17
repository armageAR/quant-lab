import { DynamicModule, Module } from '@nestjs/common';
import type { DatabaseLifecycle } from '@quant-lab/database';
import type { ApplicationMetrics } from '@quant-lab/shared';

import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { DATABASE, METRICS } from './tokens';

@Module({})
export class AppModule {
  static register(
    database: DatabaseLifecycle,
    metrics: ApplicationMetrics,
  ): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, MetricsController],
      providers: [
        { provide: DATABASE, useValue: database },
        { provide: METRICS, useValue: metrics },
      ],
    };
  }
}

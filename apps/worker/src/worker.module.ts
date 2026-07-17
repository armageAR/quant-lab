import { DynamicModule, Module } from '@nestjs/common';
import type { DatabaseLifecycle } from '@quant-lab/database';
import type { ApplicationMetrics } from '@quant-lab/shared';
import type { Logger } from 'pino';

import { DATABASE, METRICS, WORKER_LOGGER } from './tokens';
import { WorkerService } from './worker.service';

@Module({})
export class WorkerModule {
  static register(
    database: DatabaseLifecycle,
    logger: Logger,
    metrics: ApplicationMetrics,
  ): DynamicModule {
    return {
      module: WorkerModule,
      providers: [
        { provide: DATABASE, useValue: database },
        { provide: WORKER_LOGGER, useValue: logger },
        { provide: METRICS, useValue: metrics },
        WorkerService,
      ],
    };
  }
}

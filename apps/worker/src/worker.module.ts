import { DynamicModule, Module } from '@nestjs/common';
import type { DatabaseLifecycle } from '@quant-lab/database';
import type { ConnectivityConfig } from '@quant-lab/exchange-adapters';
import type { ApplicationMetrics } from '@quant-lab/shared';
import type { Logger } from 'pino';

import type { WorkerConfig } from './config';
import {
  CONNECTIVITY_CONFIG,
  DATABASE,
  METRICS,
  WORKER_CONFIG,
  WORKER_LOGGER,
} from './tokens';
import { WorkerService } from './worker.service';

@Module({})
export class WorkerModule {
  static register(
    database: DatabaseLifecycle,
    logger: Logger,
    metrics: ApplicationMetrics,
    workerConfig: WorkerConfig,
    connectivityConfig: ConnectivityConfig,
  ): DynamicModule {
    return {
      module: WorkerModule,
      providers: [
        { provide: DATABASE, useValue: database },
        { provide: WORKER_LOGGER, useValue: logger },
        { provide: METRICS, useValue: metrics },
        { provide: WORKER_CONFIG, useValue: workerConfig },
        { provide: CONNECTIVITY_CONFIG, useValue: connectivityConfig },
        WorkerService,
      ],
    };
  }
}

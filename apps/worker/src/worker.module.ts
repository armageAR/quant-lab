import { Module } from '@nestjs/common';
import { createLogger } from '@quant-lab/shared';
import type { Logger } from 'pino';

import { loadWorkerConfig } from './config';
import { WORKER_LOGGER } from './tokens';
import { WorkerService } from './worker.service';

@Module({
  providers: [
    WorkerService,
    {
      provide: WORKER_LOGGER,
      useFactory: (): Logger => createLogger(loadWorkerConfig()),
    },
  ],
})
export class WorkerModule {}

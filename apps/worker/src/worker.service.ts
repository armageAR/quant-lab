import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ApplicationMetrics } from '@quant-lab/shared';
import type { Logger } from 'pino';

import { METRICS, WORKER_LOGGER } from './tokens';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(WORKER_LOGGER) private readonly logger: Logger,
    @Inject(METRICS) private readonly metrics: ApplicationMetrics,
  ) {}

  onModuleInit(): void {
    this.metrics.workerReady.set(1);
    this.logger.info('Worker ready');
  }

  onModuleDestroy(): void {
    this.metrics.workerReady.set(0);
    this.logger.info('Worker stopped accepting operations');
  }
}

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';

import { WORKER_LOGGER } from './tokens';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  constructor(@Inject(WORKER_LOGGER) private readonly logger: Logger) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.$connect();
    this.logger.info('Worker connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

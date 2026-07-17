import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { createLogger } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

import { loadWorkerConfig } from './config';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadWorkerConfig();
  const logger = createLogger(config);

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
  });
  app.enableShutdownHooks();
  logger.info('Worker started');
}

void bootstrap();

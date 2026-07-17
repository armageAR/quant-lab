import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import {
  StructuredLogger,
  createApplicationMetrics,
  createLogger,
  createShutdownHandler,
  runMain,
} from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';
import type { Logger } from 'pino';

import { loadWorkerConfig } from './config';
import { closeHealthServer, startHealthServer } from './health-server';
import { WorkerModule } from './worker.module';

let rootLogger: Logger | undefined;

export async function bootstrap(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadWorkerConfig();
  const logger = createLogger(config);
  rootLogger = logger;
  const database = new DatabaseLifecycle();
  const metrics = createApplicationMetrics(config.APP_NAME);
  const app = await NestFactory.createApplicationContext(
    WorkerModule.register(database, logger, metrics),
    { logger: new StructuredLogger(logger) },
  );
  const healthServer = await startHealthServer(
    config.WORKER_HEALTH_PORT,
    database,
    metrics,
  );
  logger.info({ healthPort: config.WORKER_HEALTH_PORT }, 'Worker started');

  const shutdown = createShutdownHandler(
    async () => {
      metrics.gracefulShutdowns.inc();
      logger.info('Worker shutting down');
      await closeHealthServer(healthServer);
      await app.close();
      logger.info('Worker stopped');
    },
    (error) => logger.error({ err: error }, 'Worker shutdown failed'),
  );
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void runMain(bootstrap, {
  onFatal: (error) => {
    if (rootLogger) {
      rootLogger.fatal({ err: error }, 'Worker startup failed');
    } else {
      process.stderr.write(
        `${JSON.stringify({ level: 'fatal', message: 'Worker startup failed' })}\n`,
      );
    }
  },
});

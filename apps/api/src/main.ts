import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import {
  StructuredLogger,
  createApplicationMetrics,
  createLogger,
  createShutdownHandler,
  getCorrelationContext,
  normalizeCorrelationId,
  runMain,
  runWithCorrelation,
} from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import { resolve } from 'node:path';
import pinoHttp from 'pino-http';

import { AppModule } from './app.module';
import { loadApiConfig } from './config';

let rootLogger: ReturnType<typeof createLogger> | undefined;
const METRIC_ROUTES = new Set(['/health/live', '/health/ready', '/metrics']);

export async function bootstrap(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadApiConfig();
  const logger = createLogger(config);
  rootLogger = logger;
  const database = new DatabaseLifecycle();
  const metrics = createApplicationMetrics(config.APP_NAME);
  const app = await NestFactory.create(AppModule.register(database, metrics), {
    logger: new StructuredLogger(logger),
  });

  app.use((request: Request, response: Response, next: NextFunction) => {
    const correlationId = normalizeCorrelationId(
      request.headers['x-correlation-id'],
    );
    response.setHeader('x-correlation-id', correlationId);
    runWithCorrelation({ correlationId }, next);
  });
  app.use(
    pinoHttp({
      logger,
      genReqId: () =>
        getCorrelationContext()?.correlationId ??
        normalizeCorrelationId(undefined),
      customProps: () => getCorrelationContext() ?? {},
    }),
  );
  app.use((request: Request, response: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    response.on('finish', () => {
      const labels = {
        method: request.method,
        route: METRIC_ROUTES.has(request.path) ? request.path : 'other',
        status: String(response.statusCode),
      };
      metrics.httpRequests.inc(labels);
      metrics.httpDuration.observe(
        labels,
        Number(process.hrtime.bigint() - start) / 1_000_000_000,
      );
    });
    next();
  });

  await app.listen(config.PORT, '0.0.0.0');
  logger.info({ port: config.PORT }, 'API started');

  const shutdown = createShutdownHandler(
    async () => {
      metrics.gracefulShutdowns.inc();
      logger.info('API shutting down');
      await app.close();
      logger.info('API stopped');
    },
    (error) => logger.error({ err: error }, 'API shutdown failed'),
  );
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void runMain(bootstrap, {
  onFatal: (error) => {
    if (rootLogger) {
      rootLogger.fatal({ err: error }, 'API startup failed');
    } else {
      process.stderr.write(
        `${JSON.stringify({ level: 'fatal', message: 'API startup failed' })}\n`,
      );
    }
  },
});

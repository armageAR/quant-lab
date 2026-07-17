import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { createLogger } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';
import pinoHttp from 'pino-http';

import { AppModule } from './app.module';
import { loadApiConfig } from './config';

async function bootstrap(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadApiConfig();
  const logger = createLogger(config);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(pinoHttp({ logger }));
  app.enableShutdownHooks();
  await app.listen(config.PORT, '0.0.0.0');
  logger.info({ port: config.PORT }, 'API started');
}

void bootstrap();

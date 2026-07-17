import pino, { type Logger, type LoggerOptions } from 'pino';

import type { BaseConfig } from './config';

const REDACTED_PATHS = [
  'DATABASE_URL',
  'BINANCE_API_KEY',
  'BINANCE_API_SECRET',
  'KRAKEN_API_KEY',
  'KRAKEN_API_SECRET',
  'req.headers.authorization',
  'req.headers.cookie',
];

export function createLogger(config: BaseConfig): Logger {
  const options: LoggerOptions = {
    base: { app: config.APP_NAME, environment: config.NODE_ENV },
    level: config.LOG_LEVEL,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  };

  if (config.LOG_FORMAT === 'pretty') {
    return pino(options, pino.transport({ target: 'pino-pretty' }));
  }

  return pino(options);
}

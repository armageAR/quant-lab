import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino';

import type { BaseConfig } from './config';
import { getCorrelationContext } from './correlation';

const REDACTED_PATHS = [
  'DATABASE_URL',
  'BINANCE_API_KEY',
  'BINANCE_API_SECRET',
  'KRAKEN_API_KEY',
  'KRAKEN_API_SECRET',
  'req.headers.authorization',
  'req.headers.cookie',
];

export function createLogger(
  config: BaseConfig,
  destination?: DestinationStream,
): Logger {
  const options: LoggerOptions = {
    base: { app: config.APP_NAME, environment: config.NODE_ENV },
    level: config.LOG_LEVEL,
    mixin: () => getCorrelationContext() ?? {},
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  };

  if (config.LOG_FORMAT === 'pretty') {
    return pino(options, pino.transport({ target: 'pino-pretty' }));
  }

  return pino(options, destination);
}

export class StructuredLogger {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.logger.error({ context, stack }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message));
  }
}

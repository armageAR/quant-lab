import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { createLogger } from './logger';

describe('createLogger', () => {
  it('redacts configured secrets and authorization data', () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    });
    const logger = createLogger(
      {
        APP_NAME: 'test',
        LIVE_EXECUTION_ENABLED: false,
        LOG_FORMAT: 'json',
        LOG_LEVEL: 'info',
        NODE_ENV: 'test',
      },
      destination,
    );

    logger.info(
      {
        DATABASE_URL: 'postgresql://secret',
        req: { headers: { authorization: 'Bearer secret' } },
      },
      'safe message',
    );

    expect(output).not.toContain('postgresql://secret');
    expect(output).not.toContain('Bearer secret');
    expect(output).toContain('[REDACTED]');
  });
});

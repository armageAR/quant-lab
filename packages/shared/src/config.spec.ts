import { describe, expect, it } from 'vitest';

import { baseConfigSchema, parseConfig } from './config';

describe('baseConfigSchema', () => {
  it('keeps live execution disabled by default', () => {
    const config = parseConfig(baseConfigSchema, { APP_NAME: 'test' });
    expect(config.LIVE_EXECUTION_ENABLED).toBe(false);
  });

  it('parses the string false as false', () => {
    const config = parseConfig(baseConfigSchema, {
      APP_NAME: 'test',
      LIVE_EXECUTION_ENABLED: 'false',
    });
    expect(config.LIVE_EXECUTION_ENABLED).toBe(false);
  });

  it('rejects ambiguous boolean values', () => {
    expect(() =>
      parseConfig(baseConfigSchema, {
        APP_NAME: 'test',
        LIVE_EXECUTION_ENABLED: '1',
      }),
    ).toThrow('Invalid application configuration');
  });
});

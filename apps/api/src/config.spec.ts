import { describe, expect, it } from 'vitest';

import { loadApiConfig } from './config';

describe('loadApiConfig', () => {
  it('requires a database URL', () => {
    expect(() => loadApiConfig({ APP_NAME: 'api' })).toThrow(
      'Invalid application configuration',
    );
  });

  it('loads a valid safe configuration', () => {
    const config = loadApiConfig({
      APP_NAME: 'api',
      DATABASE_URL: 'postgresql://localhost:5432/quant_lab',
      LIVE_EXECUTION_ENABLED: 'false',
    });
    expect(config.PORT).toBe(3000);
    expect(config.LIVE_EXECUTION_ENABLED).toBe(false);
  });
});

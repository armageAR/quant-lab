import { describe, expect, it } from 'vitest';

import { loadWorkerConfig } from './config';

describe('loadWorkerConfig', () => {
  it('uses a distinct worker service name', () => {
    const config = loadWorkerConfig({
      DATABASE_URL: 'postgresql://localhost:5432/quant_lab',
    });

    expect(config.APP_NAME).toBe('quant-lab-worker');
    expect(config.LIVE_EXECUTION_ENABLED).toBe(false);
    expect(config.OBSERVATION_LOOP_ENABLED).toBe(true);
    expect(config.OBSERVATION_INTERVAL_MS).toBe(10_000);
    expect(config.PAPER_TRADING_ENABLED).toBe(false);
  });
});

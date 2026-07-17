import { describe, expect, it } from 'vitest';

import { loadConnectivityConfig, venueConfig } from './config';

describe('exchange connectivity configuration', () => {
  it('requires explicit enablement and paired credentials', () => {
    const config = loadConnectivityConfig({
      BINANCE_SANDBOX: 'true',
      KRAKEN_SANDBOX: 'false',
    });
    expect(config.EXCHANGE_CONNECTIVITY_ENABLED).toBe(false);
    expect(() => venueConfig(config, 'binance')).toThrow('not configured');
    expect(() =>
      loadConnectivityConfig({
        BINANCE_API_KEY: 'key',
        BINANCE_SANDBOX: 'true',
      }),
    ).toThrow();
  });

  it('rejects unsupported Kraken Spot sandbox selection', () => {
    const config = loadConnectivityConfig({
      KRAKEN_API_KEY: 'key',
      KRAKEN_API_SECRET: 'secret',
      KRAKEN_SANDBOX: 'true',
    });
    expect(() => venueConfig(config, 'kraken')).toThrow('does not provide');
  });
});

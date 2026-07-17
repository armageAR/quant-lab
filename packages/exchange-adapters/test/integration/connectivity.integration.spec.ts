import { resolve } from 'node:path';

import { config as loadEnvironment } from 'dotenv';
import { describe, expect, it } from 'vitest';

import { CcxtReadOnlyExchangeAdapter } from '../../src/adapter';
import { loadConnectivityConfig, venueConfig } from '../../src/config';

loadEnvironment({ path: resolve(__dirname, '../../../../.env'), quiet: true });
const config = loadConnectivityConfig(process.env);

for (const venue of ['binance', 'kraken'] as const) {
  const enabled =
    venue === 'binance'
      ? config.BINANCE_INTEGRATION_ENABLED
      : config.KRAKEN_INTEGRATION_ENABLED;
  describe(`${venue} authenticated connectivity`, () => {
    it.skipIf(!enabled)(
      'verifies read-only credentials against the real API',
      async () => {
        const adapter = new CcxtReadOnlyExchangeAdapter(
          venueConfig(config, venue),
        );
        try {
          const report = await adapter.verifyConnectivity(
            config.EXCHANGE_MARKETS,
          );
          expect(report.permissions).toMatchObject({
            read: true,
            trade: false,
            withdraw: false,
            accountMutation: false,
          });
          expect(report.marketCount).toBeGreaterThan(0);
        } finally {
          await adapter.close();
        }
      },
      60_000,
    );
  });
}

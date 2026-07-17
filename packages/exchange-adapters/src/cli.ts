import { resolve } from 'node:path';

import { config as loadEnvironment } from 'dotenv';

import { ProviderError } from '@quant-lab/market-data';

import { CcxtReadOnlyExchangeAdapter } from './adapter';
import { loadConnectivityConfig, venueConfig } from './config';

loadEnvironment({ path: resolve(__dirname, '../../../.env'), quiet: true });

async function main(): Promise<void> {
  const config = loadConnectivityConfig(process.env);
  if (!config.EXCHANGE_CONNECTIVITY_ENABLED) {
    throw new Error(
      'Set EXCHANGE_CONNECTIVITY_ENABLED=true to run authenticated checks',
    );
  }

  const reports = [];
  for (const venue of ['binance', 'kraken'] as const) {
    const adapter = new CcxtReadOnlyExchangeAdapter(venueConfig(config, venue));
    try {
      reports.push(await adapter.verifyConnectivity(config.EXCHANGE_MARKETS));
    } finally {
      await adapter.close();
    }
  }
  process.stdout.write(
    `${JSON.stringify({ status: 'ok', reports }, null, 2)}\n`,
  );
}

void main().catch((error: unknown) => {
  const details =
    error instanceof ProviderError
      ? {
          code: error.code,
          venueId: error.venueId,
          operation: error.operation,
          retryable: error.retryable,
        }
      : {
          code: 'configuration',
          message: error instanceof Error ? error.message : 'unknown error',
        };
  process.stderr.write(`${JSON.stringify({ status: 'error', ...details })}\n`);
  process.exitCode = 1;
});

import { DatabaseLifecycle } from '@quant-lab/database';
import { loadConnectivityConfig } from '@quant-lab/exchange-adapters';
import { ObservedOpportunityService } from '@quant-lab/market-ingestion';
import { runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

import { loadWorkerConfig } from './config';

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const workerConfig = loadWorkerConfig();
  const connectivity = loadConnectivityConfig(process.env);
  const database = new DatabaseLifecycle();
  await database.connect();
  try {
    const results = await new ObservedOpportunityService(
      database.client,
    ).evaluateAll(
      {
        id: 'cross-venue-observed',
        version: workerConfig.OBSERVED_DETECTOR_VERSION,
        maximumBookAgeMs: workerConfig.OBSERVED_MAX_BOOK_AGE_MS,
        maximumCrossVenueSkewMs: workerConfig.OBSERVED_MAX_SKEW_MS,
        minimumObservedSpread: workerConfig.OBSERVED_MIN_SPREAD,
      },
      new Date(),
      connectivity.EXCHANGE_MARKETS,
    );
    process.stdout.write(
      `${JSON.stringify({ evaluated: results.length, observed: results.filter((result) => result.classification === 'observed').length, rejected: results.filter((result) => result.classification === 'rejected').length })}\n`,
    );
  } finally {
    await database.disconnect();
  }
}

void runMain(main, {
  onFatal: (error) =>
    process.stderr.write(
      `${JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' })}\n`,
    ),
});

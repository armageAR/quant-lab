import { DatabaseLifecycle } from '@quant-lab/database';
import { ObservedOpportunityService } from '@quant-lab/market-ingestion';
import { runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const database = new DatabaseLifecycle();
  await database.connect();
  try {
    const results = await new ObservedOpportunityService(
      database.client,
    ).evaluateAll({
      id: 'cross-venue-observed',
      version: process.env.OBSERVED_DETECTOR_VERSION ?? '1.0.0',
      maximumBookAgeMs: Number(process.env.OBSERVED_MAX_BOOK_AGE_MS ?? '5000'),
      maximumCrossVenueSkewMs: Number(
        process.env.OBSERVED_MAX_SKEW_MS ?? '1000',
      ),
      minimumObservedSpread: process.env.OBSERVED_MIN_SPREAD ?? '0',
    });
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

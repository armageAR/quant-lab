import { DatabaseLifecycle } from '@quant-lab/database';
import { ExecutableOpportunityService } from '@quant-lab/market-ingestion';
import { runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

import { buildExecutableDetectorConfig, loadWorkerConfig } from './config';

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadWorkerConfig();
  const detector = buildExecutableDetectorConfig(config);
  const database = new DatabaseLifecycle();
  await database.connect();
  try {
    const results = await new ExecutableOpportunityService(
      database.client,
      config.OBSERVATION_ORDER_BOOK_DEPTH,
    ).evaluateAll(detector);
    const count = (classification: string) =>
      results.filter((result) => result.classification === classification)
        .length;
    process.stdout.write(
      `${JSON.stringify({
        evaluated: results.length,
        executable: count('executable'),
        missed: count('missed'),
        observed: count('observed'),
        rejected: count('rejected'),
      })}\n`,
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

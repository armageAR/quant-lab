import {
  ArbitrageResearchService,
  researchReportConfigFromEnv,
  type ResearchQuery,
} from '@quant-lab/analytics';
import { DatabaseLifecycle } from '@quant-lab/database';
import { runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((argument) => argument.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function date(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new Error(`${field} must be an ISO-8601 date`);
  return parsed;
}

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const from = date(flag('from'), 'from');
  const to = date(flag('to'), 'to');
  const query: ResearchQuery = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(flag('symbol') ? { canonicalSymbol: flag('symbol') } : {}),
    ...(flag('dataset') ? { datasetId: flag('dataset') } : {}),
  };
  const asCsv = process.argv.includes('--csv');
  const database = new DatabaseLifecycle();
  await database.connect();
  try {
    const service = new ArbitrageResearchService(
      database.client,
      researchReportConfigFromEnv(),
    );
    if (asCsv) {
      process.stdout.write(`${await service.csv(query)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(await service.report(query))}\n`);
    }
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

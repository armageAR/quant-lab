import { DatabaseLifecycle } from '@quant-lab/database';
import { HistoricalDatasetService } from '@quant-lab/market-ingestion';
import { runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const database = new DatabaseLifecycle();
  await database.connect();
  try {
    const datasets = new HistoricalDatasetService(database.client);
    const action = process.argv[2];
    const id = option('id');
    let result: unknown;
    if (action === 'create') {
      const markets = option('markets');
      const from = option('from');
      const to = option('to');
      if (!markets || !from || !to)
        throw new Error('create requires --markets, --from, and --to');
      result = await datasets.create({
        marketIds: markets.split(',').filter(Boolean),
        from: new Date(from),
        to: new Date(to),
        ...(option('schema') ? { schemaVersion: option('schema') } : {}),
      });
    } else {
      if (!id) throw new Error(`${action ?? 'action'} requires --id`);
      if (action === 'inspect') result = await datasets.inspect(id);
      else if (action === 'validate')
        result = await datasets.validate(
          id,
          Number(option('max-gap-ms') ?? '60000'),
        );
      else if (action === 'pin') result = await datasets.pin(id);
      else if (action === 'export')
        result = await datasets.export(id, option('directory'));
      else if (action === 'compact')
        result = await datasets.compact(id, option('directory'));
      else
        throw new Error(
          'action must be create, inspect, validate, pin, export, or compact',
        );
    }
    process.stdout.write(`${JSON.stringify(result)}\n`);
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

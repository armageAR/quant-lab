import { DatabaseLifecycle } from '@quant-lab/database';
import { MarketEventStore } from '@quant-lab/market-ingestion';
import { runMain } from '@quant-lab/shared';
import { config } from 'dotenv';
import { resolve } from 'node:path';
async function main(): Promise<void> {
  config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const db = new DatabaseLifecycle();
  try {
    await db.connect();
    const days = Math.max(
      1,
      Number(process.env.MARKET_DATA_RETENTION_DAYS ?? '90'),
    );
    const result = await new MarketEventStore(db.client).retainBefore(
      new Date(Date.now() - days * 86400000),
    );
    process.stdout.write(`${JSON.stringify({ days, result })}\n`);
  } finally {
    await db.disconnect();
  }
}
void runMain(main);

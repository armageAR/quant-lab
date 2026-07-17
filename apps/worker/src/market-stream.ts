import { DatabaseLifecycle } from '@quant-lab/database';
import {
  CcxtReadOnlyExchangeAdapter,
  type TickerWebSocketSubscription,
  loadConnectivityConfig,
  venueConfig,
} from '@quant-lab/exchange-adapters';
import { MarketEventStore } from '@quant-lab/market-ingestion';
import { createApplicationMetrics, runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';
async function main(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadConnectivityConfig(process.env);
  const db = new DatabaseLifecycle();
  const names = [
    ...(config.BINANCE_INTEGRATION_ENABLED ? (['binance'] as const) : []),
    ...(config.KRAKEN_INTEGRATION_ENABLED ? (['kraken'] as const) : []),
  ];
  const providers = names.map(
    (name) => new CcxtReadOnlyExchangeAdapter(venueConfig(config, name)),
  );
  try {
    await db.connect();
    const metrics = createApplicationMetrics('quant-lab-market-stream');
    const store = new MarketEventStore(db.client, metrics);
    const duration = Math.max(
      1000,
      Number(process.env.INGESTION_STREAM_DURATION_MS ?? '60000'),
    );
    const subscriptions = await Promise.all(
      providers.map(async (provider) => {
        const markets = await db.client.market.findMany({
          where: { venueId: provider.venue.id, status: 'active' },
          select: { id: true },
        });
        return provider.subscribeTickersWithTelemetry(
          markets.map((m) => m.id),
          async (ticker) => {
            await store.storeTicker(ticker);
          },
          {
            onGap: () =>
              metrics.ingestionGaps.inc({
                venue: provider.venue.id,
                type: 'ticker',
              }),
            onRejected: () =>
              metrics.ingestionRejected.inc({
                venue: provider.venue.id,
                type: 'ticker',
              }),
          },
        ) as Promise<TickerWebSocketSubscription>;
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, duration));
    await Promise.all(
      subscriptions.map((subscription) => subscription[Symbol.asyncDispose]()),
    );
    process.stdout.write(
      `${JSON.stringify({ duration, results: subscriptions.map((subscription) => subscription.stats) })}\n`,
    );
  } finally {
    await Promise.all(providers.map((p) => p.close()));
    await db.disconnect();
  }
}
void runMain(main, {
  onFatal: (e) =>
    process.stderr.write(
      `${JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' })}\n`,
    ),
});

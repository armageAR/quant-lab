import { DatabaseLifecycle } from '@quant-lab/database';
import {
  CcxtReadOnlyExchangeAdapter,
  loadConnectivityConfig,
  venueConfig,
} from '@quant-lab/exchange-adapters';
import { MarketEventStore } from '@quant-lab/market-ingestion';
import { createApplicationMetrics, runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

async function ingest(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadConnectivityConfig(process.env);
  const database = new DatabaseLifecycle();
  const venues = [
    ...(config.BINANCE_INTEGRATION_ENABLED ? (['binance'] as const) : []),
    ...(config.KRAKEN_INTEGRATION_ENABLED ? (['kraken'] as const) : []),
  ];
  const providers = venues.map(
    (venue) => new CcxtReadOnlyExchangeAdapter(venueConfig(config, venue)),
  );
  try {
    await database.connect();
    const store = new MarketEventStore(
      database.client,
      createApplicationMetrics('quant-lab-market-ingest'),
    );
    let tickers = 0,
      trades = 0,
      candles = 0,
      orderBooks = 0;
    for (const provider of providers) {
      await store.storeClockDrift(await provider.getClockDrift());
      const markets = await database.client.market.findMany({
        where: {
          venueId: provider.venue.id,
          status: 'active',
          spot: true,
          instrument: { canonicalSymbol: { in: config.EXCHANGE_MARKETS } },
        },
      });
      for (const market of markets) {
        if (await store.storeTicker(await provider.fetchTicker(market.id)))
          tickers++;
        trades += await store.storeTrades(
          await provider.fetchTrades(market.id, undefined, 100),
        );
        candles += await store.storeCandles(
          await provider.fetchCandles(
            market.id,
            '1m',
            Date.now() - 3_600_000,
            60,
          ),
        );
        if (
          await store.storeOrderBook(
            await provider.fetchOrderBook(market.id, 100),
          )
        )
          orderBooks++;
      }
    }
    process.stdout.write(
      `${JSON.stringify({ tickers, trades, candles, orderBooks })}\n`,
    );
  } finally {
    await Promise.all(providers.map((provider) => provider.close()));
    await database.disconnect();
  }
}
void runMain(ingest, {
  onFatal: (error) =>
    process.stderr.write(
      `${JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' })}\n`,
    ),
});

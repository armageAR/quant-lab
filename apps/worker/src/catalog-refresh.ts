import { DatabaseLifecycle } from '@quant-lab/database';
import {
  CcxtReadOnlyExchangeAdapter,
  loadConnectivityConfig,
  venueConfig,
} from '@quant-lab/exchange-adapters';
import { MarketCatalog } from '@quant-lab/market-catalog';
import { runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

async function refreshCatalog(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadConnectivityConfig(process.env);
  if (!config.EXCHANGE_CONNECTIVITY_ENABLED) {
    throw new Error('EXCHANGE_CONNECTIVITY_ENABLED must be true');
  }
  const enabledVenues = [
    ...(config.BINANCE_INTEGRATION_ENABLED ? (['binance'] as const) : []),
    ...(config.KRAKEN_INTEGRATION_ENABLED ? (['kraken'] as const) : []),
  ];
  if (enabledVenues.length === 0) {
    throw new Error('at least one exchange integration must be enabled');
  }
  const providers = enabledVenues.map(
    (venue) => new CcxtReadOnlyExchangeAdapter(venueConfig(config, venue)),
  );
  const database = new DatabaseLifecycle();
  try {
    await database.connect();
    const result = await new MarketCatalog(database.client).refresh(
      providers,
      config.EXCHANGE_MARKETS,
    );
    process.stdout.write(`${JSON.stringify({ result })}\n`);
  } finally {
    await Promise.all(providers.map((provider) => provider.close()));
    await database.disconnect();
  }
}

void runMain(refreshCatalog, {
  onFatal: (error) => {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`${JSON.stringify({ error: message })}\n`);
  },
});

import type { DatabaseClient } from '@quant-lab/database';
import type { MarketCatalog } from '@quant-lab/market-catalog';
import type {
  MarketEventStore,
  ObservedOpportunityService,
} from '@quant-lab/market-ingestion';
import type { Logger } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObservationLoop } from './observation-loop';

describe('ObservationLoop', () => {
  afterEach(() => vi.useRealTimers());

  it('refreshes, stores all configured books, and evaluates once per cycle', async () => {
    const markets = [
      { id: 'BINANCE:BTCUSDT', venueId: 'BINANCE' },
      { id: 'KRAKEN:XBTUSDT', venueId: 'KRAKEN' },
    ];
    const database = {
      market: { findMany: vi.fn().mockResolvedValue(markets) },
    } as unknown as DatabaseClient;
    const providers = markets.map((market) => ({
      venue: { id: market.venueId },
      listMarkets: vi.fn(),
      getTradingRules: vi.fn(),
      getEffectiveFees: vi.fn(),
      getCapabilities: vi.fn(),
      fetchOrderBook: vi.fn().mockResolvedValue({ marketId: market.id }),
    }));
    const refresh = vi.fn().mockResolvedValue([]);
    const catalog = {
      refresh,
    } as unknown as MarketCatalog;
    const storeOrderBook = vi.fn().mockResolvedValue(true);
    const store = {
      storeOrderBook,
    } as unknown as MarketEventStore;
    const evaluateAll = vi
      .fn()
      .mockResolvedValue([
        { classification: 'observed' },
        { classification: 'rejected' },
      ]);
    const opportunities = {
      evaluateAll,
    } as unknown as ObservedOpportunityService;
    const loop = new ObservationLoop(
      database,
      providers as unknown as ConstructorParameters<typeof ObservationLoop>[1],
      catalog,
      store,
      opportunities,
      {
        intervalMs: 10_000,
        catalogRefreshMs: 60_000,
        orderBookDepth: 100,
        maxBackoffMs: 60_000,
        markets: ['BTC/USDT'],
        detector: {
          id: 'cross-venue-observed',
          version: '1.0.0',
          maximumBookAgeMs: 5_000,
          maximumCrossVenueSkewMs: 1_000,
          minimumObservedSpread: '0',
        },
      },
      { info: vi.fn(), error: vi.fn() } as unknown as Logger,
    );

    await loop.runOnce(new Date('2026-07-18T00:00:00Z'));

    expect(refresh).toHaveBeenCalledOnce();
    expect(storeOrderBook).toHaveBeenCalledTimes(2);
    expect(evaluateAll).toHaveBeenCalledOnce();
    expect(loop.status()).toMatchObject({
      cycles: 1,
      orderBooks: 2,
      evaluations: 2,
      observed: 1,
      rejected: 1,
      consecutiveFailures: 0,
    });
  });

  it('starts only one cycle and enters bounded backoff after failure', async () => {
    vi.useFakeTimers();
    const refresh = vi
      .fn()
      .mockRejectedValue(new Error('exchange unavailable'));
    const loop = new ObservationLoop(
      { market: { findMany: vi.fn() } } as unknown as DatabaseClient,
      [],
      { refresh } as unknown as MarketCatalog,
      {} as MarketEventStore,
      {} as ObservedOpportunityService,
      {
        intervalMs: 1_000,
        catalogRefreshMs: 60_000,
        orderBookDepth: 100,
        maxBackoffMs: 8_000,
        markets: ['BTC/USDT'],
        detector: {
          id: 'cross-venue-observed',
          version: '1.0.0',
          maximumBookAgeMs: 5_000,
          maximumCrossVenueSkewMs: 1_000,
          minimumObservedSpread: '0',
        },
      },
      { info: vi.fn(), error: vi.fn() } as unknown as Logger,
    );

    loop.start();
    loop.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(refresh).toHaveBeenCalledOnce();
    expect(loop.status()).toMatchObject({
      state: 'backoff',
      consecutiveFailures: 1,
      lastError: 'exchange unavailable',
    });
    await loop.stop();
  });
});

import type { DatabaseClient } from '@quant-lab/database';
import type { MarketCatalog } from '@quant-lab/market-catalog';
import type {
  ExecutableOpportunityService,
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

  it('runs the executable stage and reports its counters when configured', async () => {
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
    const observedEvaluate = vi
      .fn()
      .mockResolvedValue([{ classification: 'observed' }]);
    const executableEvaluate = vi
      .fn()
      .mockResolvedValue([
        { classification: 'executable' },
        { classification: 'missed' },
        { classification: 'observed' },
      ]);
    const loop = new ObservationLoop(
      database,
      providers as unknown as ConstructorParameters<typeof ObservationLoop>[1],
      { refresh: vi.fn().mockResolvedValue([]) } as unknown as MarketCatalog,
      {
        storeOrderBook: vi.fn().mockResolvedValue(true),
      } as unknown as MarketEventStore,
      {
        evaluateAll: observedEvaluate,
      } as unknown as ObservedOpportunityService,
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
      {
        service: {
          evaluateAll: executableEvaluate,
        } as unknown as ExecutableOpportunityService,
        detector: {
          id: 'cross-venue-executable',
          version: '1.0.0',
          maximumBookAgeMs: 5_000,
          maximumCrossVenueSkewMs: 1_000,
          tradeSizes: ['1'],
          slippageBufferRate: '0',
          latencyBufferMs: 250,
          minimumNetProfitRate: '0',
          inventory: {},
        },
      },
    );

    await loop.runOnce(new Date('2026-07-18T00:00:00Z'));

    expect(executableEvaluate).toHaveBeenCalledOnce();
    expect(loop.status()).toMatchObject({
      executableEvaluations: 3,
      executable: 1,
      missed: 1,
    });
  });

  it('isolates catalog and individual market timeouts from the cycle', async () => {
    const markets = [
      { id: 'BINANCE:BTCUSDT', venueId: 'BINANCE' },
      { id: 'BINANCE:ETHUSDT', venueId: 'BINANCE' },
      { id: 'KRAKEN:XETHZUSD', venueId: 'KRAKEN' },
    ];
    const successfulBook = { marketId: markets[1]!.id };
    const providers = [
      {
        venue: { id: 'BINANCE' },
        fetchOrderBook: vi
          .fn()
          .mockRejectedValueOnce(new Error('exchange operation timed out'))
          .mockResolvedValueOnce(successfulBook),
      },
      {
        venue: { id: 'KRAKEN' },
        fetchOrderBook: vi
          .fn()
          .mockRejectedValue(new Error('exchange operation timed out')),
      },
    ];
    const storeOrderBook = vi.fn().mockResolvedValue(true);
    const evaluateAll = vi
      .fn()
      .mockResolvedValue([{ classification: 'observed' }]);
    const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
    const loop = new ObservationLoop(
      {
        market: { findMany: vi.fn().mockResolvedValue(markets) },
      } as unknown as DatabaseClient,
      providers as unknown as ConstructorParameters<typeof ObservationLoop>[1],
      {
        refresh: vi
          .fn()
          .mockRejectedValue(new Error('catalog request timed out')),
      } as unknown as MarketCatalog,
      { storeOrderBook } as unknown as MarketEventStore,
      { evaluateAll } as unknown as ObservedOpportunityService,
      {
        intervalMs: 10_000,
        catalogRefreshMs: 60_000,
        orderBookDepth: 100,
        maxBackoffMs: 60_000,
        markets: ['BTC/USDT', 'ETH/USDT'],
        detector: {
          id: 'cross-venue-observed',
          version: '1.0.0',
          maximumBookAgeMs: 5_000,
          maximumCrossVenueSkewMs: 1_000,
          minimumObservedSpread: '0',
        },
      },
      logger as unknown as Logger,
    );

    await loop.runOnce(new Date('2026-07-18T00:00:00Z'));

    expect(storeOrderBook).toHaveBeenCalledOnce();
    expect(evaluateAll).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(loop.status()).toMatchObject({
      cycles: 1,
      consecutiveFailures: 0,
      orderBooks: 1,
      orderBookFailures: 2,
      evaluations: 1,
    });
  });

  it('starts only one cycle and enters bounded backoff after failure', async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue([]);
    const loop = new ObservationLoop(
      {
        market: {
          findMany: vi
            .fn()
            .mockRejectedValue(new Error('database unavailable')),
        },
      } as unknown as DatabaseClient,
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
      lastError: 'database unavailable',
    });
    await loop.stop();
  });
});

import type { MarketCatalog } from '@quant-lab/market-catalog';
import type { MarketEventStore } from '@quant-lab/market-ingestion';
import { describe, expect, it, vi } from 'vitest';

import { MarketsController } from './markets.controller';

describe('MarketsController', () => {
  it('returns comparable active market read models', async () => {
    const result = [{ marketId: 'BINANCE:BTCUSDT' }];
    const catalog = {
      listComparableActiveMarkets: vi.fn().mockResolvedValue(result),
    };
    const controller = new MarketsController(
      catalog as unknown as MarketCatalog,
      {} as MarketEventStore,
    );

    await expect(controller.comparable()).resolves.toBe(result);
  });

  it('bounds historical queries', async () => {
    const events = {
      trades: vi.fn().mockResolvedValue([]),
      tickers: vi.fn(),
      candles: vi.fn(),
    };
    const controller = new MarketsController(
      { listComparableActiveMarkets: vi.fn() } as unknown as MarketCatalog,
      events as unknown as MarketEventStore,
    );
    await expect(controller.trades('BINANCE:BTCUSDT', '500')).resolves.toEqual(
      [],
    );
    expect(() => controller.trades('BINANCE:BTCUSDT', '501')).toThrow(
      'limit must be between',
    );
    expect(() => controller.candles('BINANCE:BTCUSDT')).toThrow(
      'interval is required',
    );
  });
});

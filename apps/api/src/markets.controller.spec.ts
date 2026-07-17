import type { MarketCatalog } from '@quant-lab/market-catalog';
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
    );

    await expect(controller.comparable()).resolves.toBe(result);
  });
});

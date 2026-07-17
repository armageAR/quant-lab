import {
  eventTimepoint,
  Price,
  Quantity,
  SourceTimestamp,
} from '@quant-lab/core';
import type { OrderBook } from '@quant-lab/market-data';
import { describe, expect, it } from 'vitest';

import { OrderBookEngine } from './order-book';

const marketId = 'BINANCE:BTCUSDT';
const time = (milliseconds: string) => {
  const value = SourceTimestamp.fromEpochMilliseconds(milliseconds);
  return eventTimepoint({
    eventTime: value,
    receivedAt: value,
    processedAt: value,
  });
};
const level = (side: 'bid' | 'ask', price: string, quantity: string) => ({
  side,
  price: Price.from(price, marketId),
  quantity: Quantity.from(quantity, 'BTC'),
});
const book = (overrides: Partial<OrderBook> = {}): OrderBook => ({
  venueId: 'BINANCE',
  marketId,
  source: 'fixture',
  kind: 'snapshot',
  sequence: '10',
  time: time('1700000000000'),
  bids: [level('bid', '100', '2'), level('bid', '99', '4')],
  asks: [level('ask', '101', '3'), level('ask', '102', '5')],
  ...overrides,
});

describe('OrderBookEngine', () => {
  it('reconstructs deterministic sorted depth and removes zero quantities', () => {
    const engine = new OrderBookEngine({ depth: 2 });
    engine.apply(book());
    const result = engine.apply(
      book({
        kind: 'delta',
        sequence: '11',
        previousSequence: '10',
        bids: [level('bid', '100', '0'), level('bid', '98', '7')],
        asks: [level('ask', '101', '1')],
      }),
    );
    expect(result).toMatchObject({
      valid: true,
      sequence: '11',
      bids: [
        { price: '99', quantity: '4' },
        { price: '98', quantity: '7' },
      ],
      asks: [
        { price: '101', quantity: '1' },
        { price: '102', quantity: '5' },
      ],
    });
  });

  it('invalidates sequence gaps rather than applying them', () => {
    const engine = new OrderBookEngine();
    engine.apply(book());
    const result = engine.apply(
      book({ kind: 'delta', sequence: '12', previousSequence: '11' }),
    );
    expect(result.valid).toBe(false);
    expect(result.invalidation?.reason).toBe('sequence_gap');
  });

  it('invalidates crossed and stale books', () => {
    let now = 1_700_000_000_000;
    const engine = new OrderBookEngine({ staleAfterMs: 1000, now: () => now });
    expect(
      engine.apply(book({ bids: [level('bid', '102', '1')] })).invalidation
        ?.reason,
    ).toBe('crossed_book');
    const fresh = new OrderBookEngine({ staleAfterMs: 1000, now: () => now });
    fresh.apply(book());
    now += 1001;
    expect(fresh.current().invalidation?.reason).toBe('stale_book');
  });

  it('supports venue checksum validation hooks', () => {
    const engine = new OrderBookEngine({ verifyChecksum: () => false });
    const result = engine.apply(book({ checksum: 'bad' }));
    expect(result.invalidation?.reason).toBe('checksum_mismatch');
  });
});

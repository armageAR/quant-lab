import { describe, expect, it } from 'vitest';

import {
  ObservedArbitrageDetector,
  type ObservedBookInput,
} from './observed-arbitrage';

const detector = new ObservedArbitrageDetector({
  id: 'cross-venue-observed',
  version: '1.0.0',
  maximumBookAgeMs: 1000,
  maximumCrossVenueSkewMs: 100,
  minimumObservedSpread: '0.001',
});
const now = new Date('2026-07-18T00:00:01Z');
const book = (
  overrides: Partial<ObservedBookInput> = {},
): ObservedBookInput => ({
  eventId: 'book-1',
  marketId: 'BINANCE:BTCUSDT',
  venueId: 'BINANCE',
  sequence: '1',
  receivedAt: new Date('2026-07-18T00:00:00.950Z'),
  valid: true,
  bestBid: '99',
  bestAsk: '100',
  ...overrides,
});

describe('ObservedArbitrageDetector', () => {
  it.each([
    [Number.NaN, 100],
    [Number.POSITIVE_INFINITY, 100],
    [0, 100],
    [1000, Number.NaN],
    [1000, Number.POSITIVE_INFINITY],
    [1000, -1],
  ])(
    'rejects invalid timing thresholds (%s, %s)',
    (maximumBookAgeMs, maximumCrossVenueSkewMs) => {
      expect(
        () =>
          new ObservedArbitrageDetector({
            id: 'cross-venue-observed',
            version: '1.0.0',
            maximumBookAgeMs,
            maximumCrossVenueSkewMs,
            minimumObservedSpread: '0.001',
          }),
      ).toThrow(RangeError);
    },
  );

  it('detects a positive observed spread without executable classification', () => {
    const result = detector.evaluate(
      'BTC/USDT',
      book(),
      book({
        eventId: 'book-2',
        marketId: 'KRAKEN:XBTUSDT',
        venueId: 'KRAKEN',
        bestBid: '101',
      }),
      now,
    );
    expect(result).toMatchObject({
      classification: 'observed',
      observedSpread: '0.01',
    });
    expect(result).not.toHaveProperty('executable');
  });

  it('rejects negative spreads, stale books, and invalid books deterministically', () => {
    expect(
      detector.evaluate(
        'BTC/USDT',
        book(),
        book({ venueId: 'KRAKEN', bestBid: '99' }),
        now,
      ).rejectionReason,
    ).toBe('below_threshold');
    expect(
      detector.evaluate(
        'BTC/USDT',
        book({ receivedAt: new Date('2026-07-17T23:59:00Z') }),
        book({ venueId: 'KRAKEN' }),
        now,
      ).rejectionReason,
    ).toBe('stale_book');
    expect(
      detector.evaluate(
        'BTC/USDT',
        book({ valid: false, invalidationReason: 'crossed_book' }),
        book({ venueId: 'KRAKEN' }),
        now,
      ).rejectionReason,
    ).toBe('invalid_book');
  });
});

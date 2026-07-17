import { describe, expect, it } from 'vitest';

import { canonicalPair } from './normalization';

describe('market symbol normalization', () => {
  it.each([
    ['BTC/USDT', 'BTC/USDT'],
    ['xbt/usd', 'BTC/USD'],
    ['XDG/USD', 'DOGE/USD'],
    ['BTC/USDT:USDT', 'BTC/USDT'],
  ])('normalizes %s to %s', (venueSymbol, canonicalSymbol) => {
    expect(canonicalPair(venueSymbol).canonicalSymbol).toBe(canonicalSymbol);
  });

  it('rejects malformed market symbols', () => {
    expect(() => canonicalPair('BTCUSDT')).toThrow('invalid spot market');
  });
});

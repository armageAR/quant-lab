import { describe, expect, it } from 'vitest';
import { canonical, decimal, nextOrderStatus } from './model';

describe('paper accounting model', () => {
  it('enforces terminal order states', () => {
    expect(nextOrderStatus('created', 'reserve')).toBe('reserved');
    expect(nextOrderStatus('reserved', 'partial_fill')).toBe(
      'partially_filled',
    );
    expect(nextOrderStatus('partially_filled', 'fill')).toBe('filled');
    expect(() => nextOrderStatus('filled', 'cancel')).toThrow(
      'invalid paper order transition',
    );
  });

  it('preserves double-entry sums for varied exact decimals', () => {
    for (let index = 1; index <= 500; index += 1) {
      const amount = decimal(String(index)).dividedBy('137');
      expect(canonical(amount.plus(amount.negated()))).toBe('0');
    }
  });
});

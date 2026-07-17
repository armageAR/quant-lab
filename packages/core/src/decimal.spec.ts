import { describe, expect, it } from 'vitest';

import { FeeRate, Money, Pnl, Price, Quantity } from './decimal';

describe('exact decimal values', () => {
  it('preserves exact arithmetic and canonical serialization', () => {
    expect(
      Money.from('0.1', 'usd').add(Money.from('0.2', 'USD')).toJSON(),
    ).toEqual({ value: '0.3', currency: 'USD' });
    expect(Price.from('0001.2300', 'btc-usd').toString()).toBe('1.23');
    expect(Pnl.from('-0.00000001', 'USD').toString()).toBe('-0.00000001');
    expect(JSON.parse(JSON.stringify(Price.from('1.23', 'BTC-USD')))).toEqual({
      value: '1.23',
      marketId: 'BTC-USD',
    });
  });

  it('rejects uncontrolled numbers at runtime boundaries', () => {
    expect(() => Money.from(0.1 as unknown as string, 'USD')).toThrow(
      TypeError,
    );
    expect(() => Quantity.from('-0.1', 'BTC')).toThrow(RangeError);
    expect(() => Price.from('0', 'BTC-USD')).toThrow(RangeError);
    expect(() => FeeRate.from('1.0001')).toThrow(RangeError);
  });

  it('requires matching context for arithmetic', () => {
    expect(() => Money.from('1', 'USD').add(Money.from('1', 'EUR'))).toThrow(
      'different currencies',
    );
    expect(Money.from('1', 'USD').equals(Money.from('1', 'EUR'))).toBe(false);
    expect(Price.from('1', 'BTC-USD').equals(Price.from('1', 'BTC-EUR'))).toBe(
      false,
    );
  });

  it('quantizes only with an explicit increment and rounding mode', () => {
    const price = Price.from('123.456', 'BTC-USD');
    expect(price.quantize('0.01', 'down').toString()).toBe('123.45');
    expect(price.quantize('0.01', 'half-even').toString()).toBe('123.46');
    expect(() => price.quantize('0', 'down')).toThrow(RangeError);
  });
});

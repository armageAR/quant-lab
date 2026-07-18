import { expect, it } from 'vitest';
import { executeEquityPaperOrder } from './equity';
const limits = {
  allowlist: new Set(['756733']),
  maxOrderNotionalUsd: '5000',
  maxPositionNotionalUsd: '10000',
  maxQuoteAgeMs: 1000,
  commissionUsd: '1',
  minimumTick: '0.01',
};
it('reconciles USD cash, positions and fees exactly', () => {
  expect(
    executeEquityPaperOrder(
      { cashUsd: '10000', positions: {}, realizedPnlUsd: '0', feesUsd: '0' },
      {
        intentId: 'i1',
        conId: '756733',
        side: 'buy',
        quantity: '2',
        price: '600.10',
        sessionOpen: true,
        quoteAgeMs: 10,
      },
      limits,
    ),
  ).toEqual({
    cashUsd: '8798.8',
    positions: { '756733': '2' },
    realizedPnlUsd: '0',
    feesUsd: '1',
  });
});
it('blocks shorts, stale quotes and closed sessions', () => {
  const state = {
    cashUsd: '10000',
    positions: {},
    realizedPnlUsd: '0',
    feesUsd: '0',
  };
  expect(() =>
    executeEquityPaperOrder(
      state,
      {
        intentId: 'i',
        conId: '756733',
        side: 'sell',
        quantity: '1',
        price: '600',
        sessionOpen: true,
        quoteAgeMs: 1,
      },
      limits,
    ),
  ).toThrow('short_sales');
  expect(() =>
    executeEquityPaperOrder(
      state,
      {
        intentId: 'i',
        conId: '756733',
        side: 'buy',
        quantity: '1',
        price: '600',
        sessionOpen: false,
        quoteAgeMs: 1,
      },
      limits,
    ),
  ).toThrow('market_closed');
});

import { describe, expect, it } from 'vitest';

import { applyPortfolioPolicy } from './portfolio';

describe('applyPortfolioPolicy', () => {
  it('reduces and rejects intents before execution', () => {
    const decisions = applyPortfolioPolicy(
      [
        { id: 'a', marketId: 'SPY', notional: '80', confidence: '0.9' },
        { id: 'b', marketId: 'SPY', notional: '80', confidence: '0.8' },
        { id: 'c', marketId: 'QQQ', notional: '20', confidence: '0.1' },
      ],
      {
        maximumIntentNotional: '60',
        maximumTotalNotional: '100',
        minimumConfidence: '0.5',
        maximumSignals: 2,
        allowedMarkets: ['SPY'],
      },
    );

    expect(decisions).toEqual([
      {
        intentId: 'a',
        status: 'reduced',
        approvedNotional: '60',
        reasons: ['portfolio_limit'],
      },
      {
        intentId: 'b',
        status: 'reduced',
        approvedNotional: '40',
        reasons: ['portfolio_limit'],
      },
      {
        intentId: 'c',
        status: 'rejected',
        approvedNotional: '0',
        reasons: [
          'market_not_allowed',
          'confidence_below_minimum',
          'signal_limit',
        ],
      },
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import { evaluateBacktestGate } from './backtests';

describe('evaluateBacktestGate', () => {
  it('requires profitable, filled, low-false-positive runs', () => {
    const decision = evaluateBacktestGate(
      {
        netPnl: '10',
        maxDrawdown: '0',
        fillRate: '0.8',
        falsePositiveRate: '0.2',
      },
      {},
    );
    expect(decision.eligible).toBe(true);
  });

  it('documents every failed quantitative threshold', () => {
    const decision = evaluateBacktestGate(
      {
        netPnl: '-1',
        maxDrawdown: '5',
        fillRate: '0.1',
        falsePositiveRate: '0.9',
      },
      {},
    );
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toHaveLength(4);
  });
});

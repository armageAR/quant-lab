import { describe, expect, it } from 'vitest';

import {
  canControl,
  datasetReady,
  isUnsignedDecimal,
  runConfiguration,
} from './model';

describe('backtest UI model', () => {
  it('keeps financial decimals as exact strings', () => {
    expect(isUnsignedDecimal('0.00000001')).toBe(true);
    expect(isUnsignedDecimal('-1')).toBe(false);
    expect(isUnsignedDecimal('1e-3')).toBe(false);
    const config = runConfiguration({
      scenario: 'base',
      tradeSize: '100.00',
      orderType: 'market',
      submissionDelayMs: '25',
      cancelAfterMs: '5000',
      binanceFee: '0.001',
      krakenFee: '0.0026',
      slippageRate: '0.0002',
      rebalanceRate: '0',
      allowPartialFills: 'true',
      queueAheadRate: '0.25',
      marketImpactRate: '0.0001',
      maxLevelParticipationRate: '0.25',
      minNetPnl: '0',
      maxDrawdown: '10',
      minFillRate: '0.5',
      maxFalsePositiveRate: '0.75',
    });
    expect(config.tradeSize).toBe('100.00');
    expect(config.feeRates.KRAKEN).toBe('0.0026');
  });

  it('enforces lifecycle controls and dataset readiness', () => {
    expect(canControl('running', 'pause')).toBe(true);
    expect(canControl('completed', 'cancel')).toBe(false);
    expect(
      datasetReady({
        pinnedAt: 'now',
        qualityReport: { valid: true },
      } as never),
    ).toBe(true);
    expect(datasetReady(undefined)).toBe(false);
  });
});

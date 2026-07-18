import { describe, expect, it } from 'vitest';

import { executeArbitrageBacktest, parseBacktestConfig } from './backtest';
import type { ReplayEvent } from './replay';
import type { BacktestRunView, JsonObject } from './runs';

const configuration: JsonObject = {
  scenario: 'base',
  tradeSize: '1',
  orderType: 'market',
  submissionDelayMs: 100,
  cancelAfterMs: 1_000,
  feeRates: { BINANCE: '0.001', KRAKEN: '0.002' },
  slippageRate: '0',
  inventoryRebalanceRate: '0.01',
  fillModel: {
    version: 'fill-v1',
    allowPartialFills: true,
    queueAheadRate: '0',
    marketImpactRate: '0',
    maxLevelParticipationRate: '1',
  },
};

const run: BacktestRunView = {
  id: 'run-1',
  experimentId: 'experiment-1',
  datasetId: 'dataset-1',
  status: 'running',
  seed: 1,
  codeCommit: 'abc123',
  configuration,
  modelVersions: { replay: '1', fill: 'fill-v1' },
  progress: 0,
  totalEvents: 2,
  createdAt: new Date('2026-07-18T00:00:00Z'),
};

const event = (
  ordinal: number,
  venueId: string,
  marketId: string,
  bid: string,
  ask: string,
): ReplayEvent => ({
  ordinal,
  sourceId: `source-${ordinal}`,
  eventType: 'orderBook',
  marketId,
  venueId,
  canonicalSymbol: 'BTC/USD',
  receivedAt: `2026-07-18T00:00:0${ordinal}.000Z`,
  payload: {
    kind: 'orderBook',
    eventId: `book-${ordinal}`,
    valid: true,
    bids: [{ price: bid, quantity: '2' }],
    asks: [{ price: ask, quantity: '2' }],
  },
});

describe('executeArbitrageBacktest', () => {
  it('fills only from historical depth and includes versioned evidence', async () => {
    const result = await executeArbitrageBacktest(run, [
      event(0, 'BINANCE', 'binance-btc', '99', '100'),
      event(1, 'KRAKEN', 'kraken-btc', '102', '103'),
    ]);
    const trades = result.results.trades as unknown as Array<{
      netProfit: string;
      buyFill: { modelVersion: string; evidence: { bookEventId: string } };
    }>;
    expect(trades).toHaveLength(1);
    expect(Number(trades[0]!.netProfit)).toBeGreaterThan(0);
    expect(trades[0]!.buyFill.modelVersion).toBe('fill-v1');
    expect(trades[0]!.buyFill.evidence.bookEventId).toBe('book-0');
  });

  it('does not fill merely because an observed price exists', async () => {
    const result = await executeArbitrageBacktest(run, [
      event(0, 'BINANCE', 'binance-btc', '99', '100'),
      {
        ...event(1, 'KRAKEN', 'kraken-btc', '102', '103'),
        payload: {
          kind: 'orderBook',
          eventId: 'book-1',
          valid: true,
          bids: [],
          asks: [],
        },
      },
    ]);
    expect(result.results.trades).toEqual([]);
  });

  it('makes conservative and adverse scenarios progressively harsher', () => {
    const conservative = parseBacktestConfig({
      ...configuration,
      scenario: 'conservative',
    });
    const adverse = parseBacktestConfig({
      ...configuration,
      scenario: 'adverse',
    });
    expect(conservative.submissionDelayMs).toBe(150);
    expect(adverse.submissionDelayMs).toBe(200);
    expect(Number(adverse.fillModel.maxLevelParticipationRate)).toBeLessThan(
      Number(conservative.fillModel.maxLevelParticipationRate),
    );
  });
});

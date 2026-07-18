import { describe, expect, it } from 'vitest';

import {
  buildResearchReport,
  type ResearchRecord,
  type ResearchReportConfig,
} from './report';

const config: ResearchReportConfig = {
  submissionDelayMs: 1_000,
  episodeGapMs: 20_000,
  thresholds: {
    minExecutableCount: 2,
    maxFalsePositiveRate: '0.5',
    minMedianDurationMs: 1_000,
  },
};

const record = (overrides: Partial<ResearchRecord> = {}): ResearchRecord => ({
  canonicalSymbol: 'BTC/USD',
  direction: 'buy-binance-sell-kraken',
  classification: 'executable',
  evaluatedAt: '2026-07-18T00:00:00.000Z',
  topOfBookSpread: '0.01',
  grossProfit: '10',
  feeCost: '1',
  slippageCost: '0.5',
  netProfit: '8.5',
  buyFreshnessMs: 100,
  sellFreshnessMs: 200,
  crossVenueSkewMs: 50,
  ...overrides,
});

describe('buildResearchReport', () => {
  it('counts classifications and evaluated total', () => {
    const report = buildResearchReport(
      [
        record(),
        record({ classification: 'missed' }),
        record({ classification: 'observed' }),
        record({ classification: 'rejected', topOfBookSpread: undefined }),
      ],
      config,
    );
    expect(report.evaluated).toBe(4);
    expect(report.classificationCounts).toEqual({
      executable: 1,
      missed: 1,
      observed: 1,
      rejected: 1,
    });
  });

  it('computes the false-positive rate from apparent versus surviving edges', () => {
    // 4 apparent edges (spread > 0), 1 executable -> 3 removed / 4 = 0.75.
    const report = buildResearchReport(
      [
        record(),
        record({ classification: 'observed' }),
        record({ classification: 'missed' }),
        record({ classification: 'observed' }),
      ],
      config,
    );
    expect(report.apparentEdges).toBe(4);
    expect(report.survivingEdges).toBe(1);
    expect(report.falsePositiveRate).toBe('0.75');
  });

  it('attributes gross profit to fees, slippage, and net exactly', () => {
    const report = buildResearchReport(
      [
        record(),
        record({
          grossProfit: '20',
          feeCost: '2',
          slippageCost: '1',
          netProfit: '17',
        }),
      ],
      config,
    );
    expect(report.attribution.grossProfit).toBe('30');
    expect(report.attribution.feeCost).toBe('3');
    expect(report.attribution.slippageCost).toBe('1.5');
    expect(report.attribution.netProfit).toBe('25.5');
    expect(report.attribution.feeShare).toBe('0.1');
    expect(report.attribution.slippageShare).toBe('0.05');
  });

  it('excludes structurally rejected records from attribution', () => {
    const report = buildResearchReport(
      [record({ classification: 'rejected', grossProfit: undefined })],
      config,
    );
    expect(report.attribution.grossProfit).toBe('0');
    expect(report.attribution.feeShare).toBe('0');
  });

  it('groups executable episodes and flags those shorter than the submission delay', () => {
    // Two executable evaluations 500ms apart -> one 500ms episode < 1000ms delay.
    const report = buildResearchReport(
      [
        record({ evaluatedAt: '2026-07-18T00:00:00.000Z' }),
        record({ evaluatedAt: '2026-07-18T00:00:00.500Z' }),
      ],
      config,
    );
    expect(report.latency.episodes).toBe(1);
    expect(report.latency.medianDurationMs).toBe(500);
    expect(report.latency.removedByLatency).toBe(1);
    expect(report.latency.removedByLatencyRate).toBe('1');
  });

  it('splits episodes separated by more than the gap', () => {
    const report = buildResearchReport(
      [
        record({ evaluatedAt: '2026-07-18T00:00:00.000Z' }),
        record({ evaluatedAt: '2026-07-18T00:00:02.000Z' }),
        record({ evaluatedAt: '2026-07-18T00:01:00.000Z' }),
      ],
      config,
    );
    // First two (2s apart) form a 2000ms episode; third (58s later) is its own.
    expect(report.latency.episodes).toBe(2);
    expect(report.latency.maxDurationMs).toBe(2_000);
    expect(report.latency.removedByLatency).toBe(1);
  });

  it('summarizes feed freshness and skew', () => {
    const report = buildResearchReport(
      [
        record({
          buyFreshnessMs: 100,
          sellFreshnessMs: 300,
          crossVenueSkewMs: 40,
        }),
        record({
          buyFreshnessMs: 500,
          sellFreshnessMs: 100,
          crossVenueSkewMs: 60,
        }),
      ],
      config,
    );
    // per-record freshness = max(buy, sell) -> 300 and 500; avg 400, max 500.
    expect(report.feedQuality.averageFreshnessMs).toBe(400);
    expect(report.feedQuality.maxFreshnessMs).toBe(500);
    expect(report.feedQuality.averageSkewMs).toBe(50);
    expect(report.feedQuality.maxSkewMs).toBe(60);
  });

  it('builds symbol, direction, and daily distributions', () => {
    const report = buildResearchReport(
      [
        record({ canonicalSymbol: 'BTC/USD', direction: 'a' }),
        record({
          canonicalSymbol: 'ETH/USD',
          direction: 'b',
          classification: 'observed',
          evaluatedAt: '2026-07-19T00:00:00.000Z',
        }),
      ],
      config,
    );
    expect(report.distributionBySymbol.map((row) => row.key)).toEqual([
      'BTC/USD',
      'ETH/USD',
    ]);
    expect(report.distributionByDirection.map((row) => row.key)).toEqual([
      'a',
      'b',
    ]);
    expect(report.daily.map((row) => row.date)).toEqual([
      '2026-07-18',
      '2026-07-19',
    ]);
    expect(report.daily[0]!.netProfit).toBe('8.5');
  });

  it('marks a dataset eligible only when all thresholds pass', () => {
    const eligible = buildResearchReport(
      [
        record({ evaluatedAt: '2026-07-18T00:00:00.000Z' }),
        record({ evaluatedAt: '2026-07-18T00:00:05.000Z' }),
      ],
      config,
    );
    // one 5000ms episode, median 5000 >= 1000, 2 executable, fp-rate 0 <= 0.5.
    expect(eligible.eligibility.eligible).toBe(true);
    expect(eligible.eligibility.reasons).toHaveLength(0);
  });

  it('reports every failing eligibility reason', () => {
    const report = buildResearchReport(
      [record({ classification: 'observed' })],
      config,
    );
    expect(report.eligibility.eligible).toBe(false);
    expect(report.eligibility.reasons.length).toBeGreaterThanOrEqual(1);
    expect(
      report.eligibility.reasons.some((reason) =>
        reason.includes('executable count'),
      ),
    ).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const records = [
      record(),
      record({
        classification: 'observed',
        evaluatedAt: '2026-07-18T00:00:03.000Z',
      }),
    ];
    expect(JSON.stringify(buildResearchReport(records, config))).toBe(
      JSON.stringify(buildResearchReport(records, config)),
    );
  });

  it('handles an empty record set without dividing by zero', () => {
    const report = buildResearchReport([], config);
    expect(report.evaluated).toBe(0);
    expect(report.falsePositiveRate).toBe('0');
    expect(report.latency.removedByLatencyRate).toBe('0');
    expect(report.feedQuality.averageFreshnessMs).toBe(0);
    expect(report.eligibility.eligible).toBe(false);
  });
});

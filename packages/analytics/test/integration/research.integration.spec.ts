import { DatabaseLifecycle } from '@quant-lab/database';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ArbitrageResearchService } from '../../src';
import type { ResearchReportConfig } from '../../src';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const database = new DatabaseLifecycle();

const instrumentId = 'RPT-BTC-USD';
const canonicalSymbol = 'RPT-BTC/USD';
const binanceId = 'BINANCE:RPTBTCUSD';
const krakenId = 'KRAKEN:RPTXBTUSD';
const configurationId = 'detector_research_report_test';
const buyBookId = randomUUID();
const sellBookId = randomUUID();

const reportConfig: ResearchReportConfig = {
  submissionDelayMs: 1_000,
  episodeGapMs: 20_000,
  thresholds: {
    minExecutableCount: 1,
    maxFalsePositiveRate: '0.9',
    minMedianDurationMs: 0,
  },
};

async function cleanup(): Promise<void> {
  await database.client.executableOpportunity.deleteMany({
    where: { canonicalSymbol },
  });
  await database.client.datasetMarket.deleteMany({
    where: { marketId: { in: [binanceId, krakenId] } },
  });
  await database.client.datasetManifest.deleteMany({
    where: { id: 'ds-research-report' },
  });
  await database.client.marketOrderBookEvent.deleteMany({
    where: { id: { in: [buyBookId, sellBookId] } },
  });
  await database.client.detectorConfiguration.deleteMany({
    where: { id: configurationId },
  });
  await database.client.market.deleteMany({
    where: { id: { in: [binanceId, krakenId] } },
  });
  await database.client.instrument.deleteMany({ where: { id: instrumentId } });
}

async function opportunity(overrides: {
  classification: string;
  evaluatedAt: string;
  topOfBookSpread?: string;
  grossProfit?: string;
  feeCost?: string;
  slippageCost?: string;
  netProfit?: string;
}): Promise<void> {
  await database.client.executableOpportunity.create({
    data: {
      idempotencyKey: randomUUID(),
      configurationId,
      canonicalSymbol,
      classification: overrides.classification,
      direction: 'buy-binance-sell-kraken',
      buyMarketId: binanceId,
      sellMarketId: krakenId,
      buyVenueId: 'BINANCE',
      sellVenueId: 'KRAKEN',
      buyBookEventId: buyBookId,
      sellBookEventId: sellBookId,
      buyTakerFee: '0.001',
      sellTakerFee: '0.001',
      topOfBookSpread: overrides.topOfBookSpread ?? null,
      grossProfit: overrides.grossProfit ?? null,
      feeCost: overrides.feeCost ?? null,
      slippageCost: overrides.slippageCost ?? null,
      netProfit: overrides.netProfit ?? null,
      sizeEvaluations: [],
      buyFreshnessMs: 100,
      sellFreshnessMs: 200,
      crossVenueSkewMs: 50,
      evaluatedAt: new Date(overrides.evaluatedAt),
    },
  });
}

describe('ArbitrageResearchService integration', () => {
  beforeAll(async () => {
    await database.connect();
    await cleanup();
    for (const venueId of ['BINANCE', 'KRAKEN'])
      await database.client.venue.upsert({
        where: { id: venueId },
        create: {
          id: venueId,
          code: venueId,
          name: venueId,
          kind: 'exchange',
          status: 'active',
        },
        update: {},
      });
    await database.client.instrument.create({
      data: {
        id: instrumentId,
        kind: 'spot',
        baseCurrency: 'RPT-BTC',
        quoteCurrency: 'USD',
        canonicalSymbol,
      },
    });
    for (const [id, venueId, bookId] of [
      [binanceId, 'BINANCE', buyBookId],
      [krakenId, 'KRAKEN', sellBookId],
    ] as const) {
      await database.client.market.create({
        data: {
          id,
          venueId,
          instrumentId,
          venueSymbol: id,
          status: 'active',
          spot: true,
          firstSeenAt: new Date('2026-07-18T00:00:00Z'),
          lastSeenAt: new Date('2026-07-18T00:00:00Z'),
        },
      });
      await database.client.marketOrderBookEvent.create({
        data: {
          id: bookId,
          idempotencyKey: `${id}-book`,
          marketId: id,
          venueId,
          kind: 'snapshot',
          sequence: '1',
          receivedAt: new Date('2026-07-18T00:00:00Z'),
          processedAt: new Date('2026-07-18T00:00:00Z'),
          bids: [],
          asks: [],
          depth: 1,
          rawEnvelopeId: randomUUID(),
        },
      });
    }
    await database.client.detectorConfiguration.create({
      data: {
        id: configurationId,
        detectorId: 'cross-venue-executable',
        version: '1.0.0',
        fingerprint: 'research-report-test',
        configuration: {},
      },
    });
    await database.client.datasetManifest.create({
      data: {
        id: 'ds-research-report',
        checksum: 'research-report-checksum',
        schemaVersion: '1',
        from: new Date('2026-07-18T00:00:00Z'),
        to: new Date('2026-07-18T23:59:59Z'),
        eventCount: 0,
        sourceCoverage: {},
        markets: { create: [{ marketId: binanceId }] },
      },
    });

    // Two executable episodes on day one; one observed; one out-of-window.
    await opportunity({
      classification: 'executable',
      evaluatedAt: '2026-07-18T00:00:00Z',
      topOfBookSpread: '0.01',
      grossProfit: '10',
      feeCost: '1',
      slippageCost: '0.5',
      netProfit: '8.5',
    });
    await opportunity({
      classification: 'executable',
      evaluatedAt: '2026-07-18T00:00:05Z',
      topOfBookSpread: '0.01',
      grossProfit: '12',
      feeCost: '1',
      slippageCost: '0.5',
      netProfit: '10.5',
    });
    await opportunity({
      classification: 'observed',
      evaluatedAt: '2026-07-18T00:00:10Z',
      topOfBookSpread: '0.005',
    });
    await opportunity({
      classification: 'executable',
      evaluatedAt: '2026-07-20T00:00:00Z',
      topOfBookSpread: '0.01',
      grossProfit: '5',
      feeCost: '1',
      slippageCost: '0.5',
      netProfit: '3.5',
    });
  });

  afterAll(async () => {
    await cleanup();
    await database.disconnect();
  });

  it('reports over the full window with exact attribution', async () => {
    const service = new ArbitrageResearchService(database.client, reportConfig);
    const report = await service.report({ canonicalSymbol });
    expect(report.evaluated).toBe(4);
    expect(report.classificationCounts.executable).toBe(3);
    expect(report.classificationCounts.observed).toBe(1);
    // 4 apparent edges, 3 executable -> 1 removed / 4 = 0.25.
    expect(report.falsePositiveRate).toBe('0.25');
    expect(report.attribution.grossProfit).toBe('27');
    expect(report.attribution.netProfit).toBe('22.5');
    expect(report.daily.map((row) => row.date)).toEqual([
      '2026-07-18',
      '2026-07-20',
    ]);
  });

  it('scopes the report to a dataset manifest time range and markets', async () => {
    const service = new ArbitrageResearchService(database.client, reportConfig);
    const report = await service.report({ datasetId: 'ds-research-report' });
    // The out-of-window 2026-07-20 record is excluded.
    expect(report.evaluated).toBe(3);
    expect(report.window.datasetId).toBe('ds-research-report');
    expect(report.classificationCounts.executable).toBe(2);
  });

  it('exports deterministic CSV', async () => {
    const service = new ArbitrageResearchService(database.client, reportConfig);
    const first = await service.csv({ canonicalSymbol });
    const second = await service.csv({ canonicalSymbol });
    expect(first).toBe(second);
    expect(first.split('\n')[0]).toContain('evaluatedAt,canonicalSymbol');
    expect(first.split('\n')).toHaveLength(5); // header + 4 rows
  });
});

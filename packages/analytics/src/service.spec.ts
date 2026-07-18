import type { DatabaseClient } from '@quant-lab/database';
import { describe, expect, it, vi } from 'vitest';

import { ArbitrageResearchService } from './service';
import type { ResearchReportConfig } from './report';

const config: ResearchReportConfig = {
  submissionDelayMs: 1_000,
  episodeGapMs: 20_000,
  thresholds: {
    minExecutableCount: 1,
    maxFalsePositiveRate: '0.9',
    minMedianDurationMs: 0,
  },
};

function database(findMany = vi.fn().mockResolvedValue([])) {
  return {
    executableOpportunity: { findMany },
    datasetManifest: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'dataset-1',
        from: new Date('2026-07-18T00:00:00Z'),
        to: new Date('2026-07-18T01:00:00Z'),
        markets: [{ marketId: 'binance-btc' }, { marketId: 'kraken-btc' }],
      }),
    },
  } as unknown as DatabaseClient;
}

describe('ArbitrageResearchService', () => {
  it('requires both opportunity legs to belong to a dataset manifest', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new ArbitrageResearchService(database(findMany), config);

    await service.report({ datasetId: 'dataset-1' });

    const request = findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
    };
    expect(request.where).toMatchObject({
      buyMarketId: { in: ['binance-btc', 'kraken-btc'] },
      sellMarketId: { in: ['binance-btc', 'kraken-btc'] },
    });
  });

  it('continues loading after a full page instead of truncating the report', async () => {
    const fullPage = Array.from({ length: 10_000 }, (_, index) => ({
      id: `id-${index}`,
      canonicalSymbol: 'BTC/USD',
      direction: 'buy-binance-sell-kraken',
      classification: 'rejected',
      evaluatedAt: new Date('2026-07-18T00:00:00Z'),
      topOfBookSpread: null,
      grossProfit: null,
      feeCost: null,
      slippageCost: null,
      netProfit: null,
      buyFreshnessMs: 0,
      sellFreshnessMs: 0,
      crossVenueSkewMs: 0,
    }));
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce([]);
    const service = new ArbitrageResearchService(database(findMany), config);

    const report = await service.report();

    expect(report.evaluated).toBe(10_000);
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 10_000, take: 10_000 }),
    );
  });
});

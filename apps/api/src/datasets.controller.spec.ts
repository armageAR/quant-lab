import type { HistoricalDatasetService } from '@quant-lab/market-ingestion';
import { describe, expect, it, vi } from 'vitest';

import { DatasetsController } from './datasets.controller';

describe('DatasetsController', () => {
  it('creates and validates bounded dataset requests', async () => {
    const datasets = {
      create: vi.fn().mockResolvedValue({ id: 'dataset_1' }),
      validate: vi.fn().mockResolvedValue({ valid: true }),
    };
    const controller = new DatasetsController(
      datasets as unknown as HistoricalDatasetService,
    );
    await expect(
      controller.create({
        marketIds: ['BINANCE:BTCUSDT'],
        from: '2026-07-17T00:00:00Z',
        to: '2026-07-17T01:00:00Z',
      }),
    ).resolves.toEqual({ id: 'dataset_1' });
    await expect(controller.validate('dataset_1', '5000')).resolves.toEqual({
      valid: true,
    });
    expect(() => controller.validate('dataset_1', '0')).toThrow(
      'maxGapMs must be a positive integer',
    );
  });

  it('rejects incomplete creation input', () => {
    const controller = new DatasetsController({} as HistoricalDatasetService);
    expect(() => controller.create({ marketIds: [] })).toThrow(
      'marketIds is required',
    );
  });
});

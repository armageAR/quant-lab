import type {
  ArbitrageResearchService,
  ResearchQuery,
} from '@quant-lab/analytics';
import { describe, expect, it, vi } from 'vitest';

import { ResearchController } from './research.controller';

describe('ResearchController', () => {
  const createController = () => {
    const service = {
      report: vi.fn().mockResolvedValue({ evaluated: 0 }),
      csv: vi.fn().mockResolvedValue('header\n'),
    };
    const controller = new ResearchController(
      service as unknown as ArbitrageResearchService,
    );
    return { controller, service };
  };

  it('parses date filters and forwards a scoped query', async () => {
    const { controller, service } = createController();
    await controller.report(
      '2026-07-18T00:00:00Z',
      '2026-07-19T00:00:00Z',
      'BTC/USD',
    );
    const query = service.report.mock.calls[0]![0] as ResearchQuery;
    expect(query.from).toBeInstanceOf(Date);
    expect(query.to).toBeInstanceOf(Date);
    expect(query.canonicalSymbol).toBe('BTC/USD');
  });

  it('rejects an inverted date range', () => {
    const { controller } = createController();
    expect(() =>
      controller.report('2026-07-19T00:00:00Z', '2026-07-18T00:00:00Z'),
    ).toThrow('from must not be after to');
  });

  it('rejects a malformed date', () => {
    const { controller } = createController();
    expect(() => controller.report('not-a-date')).toThrow(
      'from must be an ISO-8601 date',
    );
  });

  it('forwards the dataset scope to the CSV export', async () => {
    const { controller, service } = createController();
    const csv = await controller.csv(undefined, undefined, undefined, 'ds-1');
    expect(csv).toBe('header\n');
    expect(service.csv.mock.calls[0]![0]).toEqual({ datasetId: 'ds-1' });
  });
});

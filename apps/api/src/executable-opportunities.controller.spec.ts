import type { ExecutableOpportunityService } from '@quant-lab/market-ingestion';
import type { ExecutableDetectorConfig } from '@quant-lab/strategy-engine';
import { describe, expect, it, vi } from 'vitest';

import { ExecutableOpportunitiesController } from './executable-opportunities.controller';

describe('ExecutableOpportunitiesController', () => {
  const createController = () => {
    const service = {
      query: vi.fn().mockResolvedValue([]),
      evaluateAll: vi.fn().mockResolvedValue([]),
    };
    const controller = new ExecutableOpportunitiesController(
      service as unknown as ExecutableOpportunityService,
    );
    return { controller, service };
  };

  it.each([
    { maximumBookAgeMs: 0 },
    { maximumCrossVenueSkewMs: -1 },
    { latencyBufferMs: -1 },
    { tradeSizes: [] },
    { tradeSizes: ['abc'] },
    { slippageBufferRate: '-0.1' },
    { minimumNetProfitRate: 'nope' },
  ])('rejects invalid configuration: %j', (body) => {
    const { controller } = createController();
    expect(() =>
      controller.evaluate(
        body as unknown as Parameters<
          ExecutableOpportunitiesController['evaluate']
        >[0],
      ),
    ).toThrow('detector configuration is invalid');
  });

  it('rejects malformed inventory', () => {
    const { controller } = createController();
    expect(() =>
      controller.evaluate({
        inventory: { BINANCE: { USD: 'not-a-number' } },
      }),
    ).toThrow('inventory amounts must be decimals');
  });

  it('applies defaults and evaluates a valid configuration', async () => {
    const { controller, service } = createController();
    await controller.evaluate({});
    expect(service.evaluateAll).toHaveBeenCalledOnce();
    const config = service.evaluateAll.mock
      .calls[0]![0] as ExecutableDetectorConfig;
    expect(config.tradeSizes).toEqual(['0.01', '0.1', '1']);
    expect(config.slippageBufferRate).toBe('0.0005');
    expect(config.inventory).toEqual({});
  });

  it('validates the query classification', async () => {
    const { controller } = createController();
    await expect(
      controller.query(undefined, 'executable', undefined, '25'),
    ).resolves.toEqual([]);
    await expect(controller.query(undefined, 'missed')).resolves.toEqual([]);
    expect(() => controller.query(undefined, 'bogus')).toThrow(
      'classification must be executable, missed, observed, or rejected',
    );
  });
});

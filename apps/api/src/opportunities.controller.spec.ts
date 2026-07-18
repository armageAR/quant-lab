import type { ObservedOpportunityService } from '@quant-lab/market-ingestion';
import { describe, expect, it, vi } from 'vitest';

import { OpportunitiesController } from './opportunities.controller';

describe('OpportunitiesController', () => {
  const createController = () => {
    const service = {
      query: vi.fn().mockResolvedValue([]),
      evaluateAll: vi.fn().mockResolvedValue([]),
    };
    return new OpportunitiesController(
      service as unknown as ObservedOpportunityService,
    );
  };

  it.each([
    { maximumBookAgeMs: 'xyz' },
    { maximumBookAgeMs: Number.NaN },
    { maximumBookAgeMs: Number.POSITIVE_INFINITY },
    { maximumBookAgeMs: 0 },
    { maximumCrossVenueSkewMs: 'xyz' },
    { maximumCrossVenueSkewMs: Number.NaN },
    { maximumCrossVenueSkewMs: Number.POSITIVE_INFINITY },
    { maximumCrossVenueSkewMs: -1 },
  ])('rejects invalid timing configuration: %j', (body) => {
    expect(() =>
      createController().evaluate(
        body as unknown as Parameters<OpportunitiesController['evaluate']>[0],
      ),
    ).toThrow('detector configuration is invalid');
  });

  it('queries only observed or rejected classifications', async () => {
    const controller = createController();
    await expect(
      controller.query(undefined, 'observed', undefined, '25'),
    ).resolves.toEqual([]);
    expect(() => controller.query(undefined, 'executable')).toThrow(
      'classification must be observed or rejected',
    );
  });
});

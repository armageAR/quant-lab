import type { ObservedOpportunityService } from '@quant-lab/market-ingestion';
import { describe, expect, it, vi } from 'vitest';

import { OpportunitiesController } from './opportunities.controller';

describe('OpportunitiesController', () => {
  it('queries only observed or rejected classifications', async () => {
    const service = {
      query: vi.fn().mockResolvedValue([]),
      evaluateAll: vi.fn(),
    };
    const controller = new OpportunitiesController(
      service as unknown as ObservedOpportunityService,
    );
    await expect(
      controller.query(undefined, 'observed', undefined, '25'),
    ).resolves.toEqual([]);
    expect(() => controller.query(undefined, 'executable')).toThrow(
      'classification must be observed or rejected',
    );
  });
});

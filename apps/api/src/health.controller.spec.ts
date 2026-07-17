import { ServiceUnavailableException } from '@nestjs/common';
import type { DatabaseLifecycle } from '@quant-lab/database';
import { createApplicationMetrics } from '@quant-lab/shared';
import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports database readiness', async () => {
    const database = { probe: vi.fn().mockResolvedValue(true) };
    const controller = new HealthController(
      database as unknown as DatabaseLifecycle,
      createApplicationMetrics('test'),
    );

    await expect(controller.ready()).resolves.toMatchObject({ status: 'ok' });
  });

  it('keeps liveness but rejects readiness when PostgreSQL is unavailable', async () => {
    const database = { probe: vi.fn().mockResolvedValue(false) };
    const controller = new HealthController(
      database as unknown as DatabaseLifecycle,
      createApplicationMetrics('test'),
    );

    expect(controller.live().status).toBe('ok');
    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

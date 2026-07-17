import type { DatabaseLifecycle } from '@quant-lab/database';
import { createApplicationMetrics } from '@quant-lab/shared';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeHealthServer, startHealthServer } from './health-server';

describe('worker health server', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => close?.());

  it('separates liveness from database readiness and exposes metrics', async () => {
    const database = { probe: vi.fn().mockResolvedValue(false) };
    const metrics = createApplicationMetrics('worker-test');
    const server = await startHealthServer(
      0,
      database as unknown as DatabaseLifecycle,
      metrics,
    );
    close = () => closeHealthServer(server);
    const { port } = server.address() as AddressInfo;

    expect((await fetch(`http://127.0.0.1:${port}/health/live`)).status).toBe(
      200,
    );
    expect((await fetch(`http://127.0.0.1:${port}/health/ready`)).status).toBe(
      503,
    );
    const output = await (
      await fetch(`http://127.0.0.1:${port}/metrics`)
    ).text();
    expect(output).toContain('quant_lab_worker_ready');
  });
});

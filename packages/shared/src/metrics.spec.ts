import { describe, expect, it } from 'vitest';

import { createApplicationMetrics } from './metrics';

describe('application metrics', () => {
  it('uses bounded operational labels', async () => {
    const metrics = createApplicationMetrics('test');
    metrics.httpRequests.inc({
      method: 'GET',
      route: '/health/live',
      status: '200',
    });
    const output = await metrics.registry.metrics();

    expect(output).toContain('quant_lab_http_requests_total');
    expect(output).toContain('app="test"');
    expect(output).toContain('route="/health/live"');
  });
});

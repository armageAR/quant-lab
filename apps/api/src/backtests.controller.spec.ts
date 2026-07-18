import type { BacktestAnalyticsService } from '@quant-lab/analytics';
import type { BacktestRunService } from '@quant-lab/simulation';
import { describe, expect, it, vi } from 'vitest';

import { BacktestsController } from './backtests.controller';

function controller() {
  const runs = {
    createExperiment: vi.fn().mockResolvedValue({ id: 'experiment-1' }),
    listExperiments: vi.fn().mockResolvedValue([]),
    queue: vi.fn().mockResolvedValue({ id: 'run-1' }),
    list: vi.fn().mockResolvedValue([]),
    pause: vi.fn().mockResolvedValue({ status: 'paused' }),
    resume: vi.fn().mockResolvedValue({ status: 'queued' }),
    cancel: vi.fn().mockResolvedValue({ status: 'cancelled' }),
  };
  const analytics = {
    inspect: vi.fn().mockResolvedValue({ id: 'run-1' }),
    compare: vi.fn().mockResolvedValue([]),
    sweep: vi.fn().mockResolvedValue([]),
    csv: vi.fn().mockResolvedValue('header\n'),
  };
  return {
    api: new BacktestsController(
      runs as unknown as BacktestRunService,
      analytics as unknown as BacktestAnalyticsService,
    ),
    runs,
    analytics,
  };
}

describe('BacktestsController', () => {
  it('queues a fully-provenanced run', async () => {
    const { api, runs } = controller();
    await api.queue({
      experimentId: 'experiment-1',
      datasetId: 'dataset-1',
      seed: 7,
      codeCommit: 'abc123',
      configuration: {},
      modelVersions: { replay: '1', fill: '1' },
    });
    expect(runs.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        experimentId: 'experiment-1',
        datasetId: 'dataset-1',
        seed: 7,
        codeCommit: 'abc123',
      }),
    );
  });

  it('rejects an unscoped run', async () => {
    const { api } = controller();
    await expect(api.queue({})).rejects.toThrow(
      'experimentId and datasetId are required',
    );
  });

  it('maps asynchronous service validation failures to bad requests', async () => {
    const { api, runs } = controller();
    runs.queue.mockRejectedValueOnce(new Error('missing model version: fees'));

    await expect(
      api.queue({ experimentId: 'experiment-1', datasetId: 'dataset-1' }),
    ).rejects.toThrow('missing model version: fees');
  });

  it('parses comparison ids and delegates CSV export', async () => {
    const { api, analytics } = controller();
    await api.compare('run-1, run-2');
    expect(analytics.compare).toHaveBeenCalledWith(['run-1', 'run-2']);
    expect(await api.csv('run-1')).toBe('header\n');
  });
});

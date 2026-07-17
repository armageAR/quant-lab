import { describe, expect, it, vi } from 'vitest';

import { createShutdownHandler, runMain } from './runtime';

describe('runMain', () => {
  it('reports startup failures and sets a non-zero exit code', async () => {
    const onFatal = vi.fn();
    const setExitCode = vi.fn();
    const error = new Error('startup failed');

    await runMain(() => Promise.reject(error), { onFatal, setExitCode });

    expect(onFatal).toHaveBeenCalledWith(error);
    expect(setExitCode).toHaveBeenCalledWith(1);
  });

  it('runs shutdown cleanup only once', async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const shutdown = createShutdownHandler(cleanup);

    await Promise.all([shutdown(), shutdown()]);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});

import { RateLimitExceeded } from 'ccxt';
import { describe, expect, it, vi } from 'vitest';

import { ResilientExecutor } from './resilience';

describe('exchange resilience', () => {
  it('retries retryable failures with bounded attempts', async () => {
    const action = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new RateLimitExceeded('slow down'))
      .mockResolvedValue('ok');
    const executor = new ResilientExecutor({
      venueId: 'BINANCE',
      attempts: 2,
      timeoutMilliseconds: 1_000,
      circuitFailures: 2,
      circuitResetMilliseconds: 1_000,
      sleep: () => Promise.resolve(),
    });
    await expect(executor.run('fetchBalance', action)).resolves.toBe('ok');
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('opens the circuit after the configured terminal failures', async () => {
    const executor = new ResilientExecutor({
      venueId: 'KRAKEN',
      attempts: 1,
      timeoutMilliseconds: 1_000,
      circuitFailures: 1,
      circuitResetMilliseconds: 60_000,
    });
    await expect(
      executor.run('loadMarkets', () => Promise.reject(new Error('down'))),
    ).rejects.toBeDefined();
    await expect(
      executor.run('loadMarkets', () => Promise.resolve('unreachable')),
    ).rejects.toMatchObject({
      code: 'temporarily-unavailable',
    });
  });
});

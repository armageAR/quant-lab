import { describe, expect, it } from 'vitest';

import { createCcxtReadOnlyClient } from './factory';

describe('CCXT read-only client factory', () => {
  it('exposes permission inspection without execution methods', async () => {
    const client = createCcxtReadOnlyClient({
      venue: 'kraken',
      apiKey: 'not-a-real-key',
      secret: 'not-a-real-secret',
      sandbox: false,
      timeoutMilliseconds: 1_000,
      retryAttempts: 1,
      circuitFailures: 1,
      circuitResetMilliseconds: 1_000,
    });
    expect(typeof client.inspectPermissions).toBe('function');
    expect('createOrder' in client).toBe(false);
    expect('cancelOrder' in client).toBe(false);
    expect('withdraw' in client).toBe(false);
    await client.close();
  });
});

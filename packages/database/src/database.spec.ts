import { describe, expect, it, vi } from 'vitest';

import { DatabaseLifecycle, type DatabaseClient } from './database';

function fakeClient(queryResult: unknown = []): {
  client: DatabaseClient;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
} {
  const connect = vi.fn();
  const disconnect = vi.fn();
  const query = vi.fn().mockResolvedValue(queryResult);
  const client = {
    $connect: connect,
    $disconnect: disconnect,
    $queryRaw: query,
  } as unknown as DatabaseClient;
  return { client, connect, disconnect, query };
}

describe('DatabaseLifecycle', () => {
  it('connects, probes, and disconnects one client', async () => {
    const { client, connect, disconnect } = fakeClient();
    const database = new DatabaseLifecycle(client);

    await database.connect();
    expect(await database.probe()).toBe(true);
    await database.disconnect();

    expect(connect).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('returns false when the health probe fails', async () => {
    const { client, query } = fakeClient();
    query.mockRejectedValueOnce(new Error('unavailable'));
    expect(await new DatabaseLifecycle(client).probe()).toBe(false);
  });
});

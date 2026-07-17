import { randomUUID } from 'node:crypto';

import { config as loadEnvironment } from 'dotenv';
import { describe, expect, it } from 'vitest';

import { DatabaseLifecycle } from '../../src/database';

loadEnvironment({ path: '../../.env', quiet: true });

describe('PostgreSQL integration', () => {
  it('connects and round-trips a platform event', async () => {
    const database = new DatabaseLifecycle();
    const id = randomUUID();

    await database.connect();
    try {
      expect(await database.probe()).toBe(true);
      await database.client.platformEvent.create({
        data: {
          id,
          source: 'integration-test',
          eventType: 'database.roundtrip',
          receivedAt: new Date(),
          payload: { test: true },
        },
      });
      const event = await database.client.platformEvent.findUniqueOrThrow({
        where: { id },
      });
      expect(event.source).toBe('integration-test');
    } finally {
      await database.client.platformEvent.deleteMany({ where: { id } });
      await database.disconnect();
    }
  });
});

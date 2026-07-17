import type { DatabaseClient } from '@quant-lab/database';
import { describe, expect, it } from 'vitest';

import { MarketEventStore } from './store';

describe('MarketEventStore', () => {
  it('bounds historical page sizes to 500', async () => {
    const findMany = (query: { take: number }) => {
      expect(query.take).toBe(500);
      return Promise.resolve([]);
    };
    const database = { marketTrade: { findMany } } as unknown as DatabaseClient;
    await expect(
      new MarketEventStore(database).trades('market', 10_000),
    ).resolves.toEqual([]);
  });
});

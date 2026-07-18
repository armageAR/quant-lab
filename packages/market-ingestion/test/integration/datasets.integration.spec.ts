import { Price, SourceTimestamp, eventTimepoint } from '@quant-lab/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import type { Ticker } from '@quant-lab/market-data';
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HistoricalDatasetService, MarketEventStore } from '../../src';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const database = new DatabaseLifecycle();
const marketId = 'DATASET:BTCUSD';

describe('HistoricalDatasetService integration', () => {
  beforeAll(async () => {
    await database.connect();
    await database.client.datasetEvent.deleteMany();
    await database.client.datasetMarket.deleteMany();
    await database.client.datasetManifest.deleteMany();
    await database.client.observedOpportunity.deleteMany();
    await database.client.detectorConfiguration.deleteMany();
    await database.client.marketTicker.deleteMany({ where: { marketId } });
    await database.client.rawMarketEnvelope.deleteMany({ where: { marketId } });
    await database.client.market.deleteMany({ where: { id: marketId } });
    await database.client.instrument.deleteMany({
      where: { id: 'DATASET-BTC-USD' },
    });
    await database.client.venue.deleteMany({ where: { id: 'DATASET' } });
    await database.client.venue.create({
      data: {
        id: 'DATASET',
        code: 'DATASET',
        name: 'Dataset Test',
        kind: 'exchange',
        status: 'active',
      },
    });
    await database.client.instrument.create({
      data: {
        id: 'DATASET-BTC-USD',
        kind: 'spot',
        baseCurrency: 'BTC',
        quoteCurrency: 'USD',
        canonicalSymbol: 'DATASET-BTC/USD',
      },
    });
    await database.client.market.create({
      data: {
        id: marketId,
        venueId: 'DATASET',
        instrumentId: 'DATASET-BTC-USD',
        venueSymbol: 'BTC/USD',
        status: 'active',
        spot: true,
        firstSeenAt: new Date('2023-11-14T22:13:00Z'),
        lastSeenAt: new Date('2023-11-14T22:20:00Z'),
      },
    });
    const store = new MarketEventStore(database.client);
    for (const [milliseconds, bid] of [
      ['1700000000000', '100'],
      ['1700000120000', '101'],
    ] as const) {
      const observed = SourceTimestamp.fromEpochMilliseconds(milliseconds);
      const ticker: Ticker = {
        venueId: 'DATASET',
        marketId,
        source: 'fixture',
        bid: Price.from(bid, marketId),
        ask: Price.from('102', marketId),
        time: eventTimepoint({
          eventTime: observed,
          receivedAt: observed,
          processedAt: observed,
        }),
      };
      await store.storeTicker(ticker);
    }
  });

  afterAll(() => database.disconnect());

  it('creates an immutable identity and fails validation on excessive gaps', async () => {
    const datasets = new HistoricalDatasetService(database.client);
    const input = {
      marketIds: [marketId],
      from: new Date('2023-11-14T22:13:00Z'),
      to: new Date('2023-11-14T22:16:00Z'),
    };
    const first = await datasets.create(input);
    const repeated = await datasets.create(input);
    expect(repeated.id).toBe(first.id);
    expect(first.eventCount).toBe(2);
    await expect(datasets.validate(first.id, 60_000)).resolves.toMatchObject({
      valid: false,
      issues: [{ code: 'source_gap', severity: 'error', marketId }],
    });
  });

  it('pins, exports ordered evidence, and protects it from retention', async () => {
    const datasets = new HistoricalDatasetService(database.client);
    const manifest = await datasets.create({
      marketIds: [marketId],
      from: new Date('2023-11-14T22:13:00Z'),
      to: new Date('2023-11-14T22:16:00Z'),
    });
    await datasets.pin(manifest.id);
    const exported = await datasets.export(
      manifest.id,
      '/tmp/quant-lab-datasets',
    );
    const lines = (await readFile(exported.path, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(2);
    await new MarketEventStore(database.client).retainBefore(
      new Date('2024-01-01T00:00:00Z'),
    );
    expect(
      await database.client.rawMarketEnvelope.count({ where: { marketId } }),
    ).toBe(2);
    await expect(datasets.compact(manifest.id)).resolves.toMatchObject({
      id: manifest.id,
      compactedAt: expect.any(Date),
    });
  });
});

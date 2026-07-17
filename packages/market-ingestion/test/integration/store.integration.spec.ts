import { Price, SourceTimestamp, eventTimepoint } from '@quant-lab/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import type { Ticker } from '@quant-lab/market-data';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MarketEventStore } from '../../src';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const db = new DatabaseLifecycle();
describe('MarketEventStore integration', () => {
  beforeAll(async () => {
    await db.connect();
    await db.client.marketTicker.deleteMany();
    await db.client.rawMarketEnvelope.deleteMany();
    await db.client.venue.upsert({
      where: { id: 'TEST' },
      create: {
        id: 'TEST',
        code: 'TEST',
        name: 'Test',
        kind: 'exchange',
        status: 'active',
      },
      update: {},
    });
    await db.client.instrument.upsert({
      where: { id: 'BTC-USD' },
      create: {
        id: 'BTC-USD',
        kind: 'spot',
        baseCurrency: 'BTC',
        quoteCurrency: 'USD',
        canonicalSymbol: 'BTC/USD',
      },
      update: {},
    });
    await db.client.market.upsert({
      where: { id: 'TEST:BTCUSD' },
      create: {
        id: 'TEST:BTCUSD',
        venueId: 'TEST',
        instrumentId: 'BTC-USD',
        venueSymbol: 'BTC/USD',
        status: 'active',
        spot: true,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
      update: {},
    });
  });
  afterAll(() => db.disconnect());
  it('persists one traceable envelope and rejects a duplicate', async () => {
    const time = SourceTimestamp.fromEpochMilliseconds('1700000000000');
    const ticker: Ticker = {
      venueId: 'TEST',
      marketId: 'TEST:BTCUSD',
      source: 'fixture',
      sourcePayload: { venueField: 'original' },
      bid: Price.from('100', 'TEST:BTCUSD'),
      time: eventTimepoint({
        eventTime: time,
        receivedAt: time,
        processedAt: time,
      }),
    };
    const store = new MarketEventStore(db.client);
    expect(await store.storeTicker(ticker)).toBe(true);
    expect(await store.storeTicker(ticker)).toBe(false);
    const row = await db.client.marketTicker.findFirstOrThrow({
      where: { marketId: ticker.marketId },
    });
    expect(
      await db.client.rawMarketEnvelope.findUnique({
        where: { id: row.rawEnvelopeId },
      }),
    ).toMatchObject({
      eventType: 'ticker',
      marketId: ticker.marketId,
      payload: { venueField: 'original' },
    });
  });
});

import {
  Price,
  Quantity,
  SourceTimestamp,
  eventTimepoint,
} from '@quant-lab/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import type { OrderBook, Ticker } from '@quant-lab/market-data';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MarketEventStore, PostgreSqlHistoricalDataProvider } from '../../src';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const db = new DatabaseLifecycle();
describe('MarketEventStore integration', () => {
  beforeAll(async () => {
    await db.connect();
    await db.client.orderBookInvalidation.deleteMany({
      where: { marketId: 'TEST:BTCUSD' },
    });
    await db.client.marketOrderBookEvent.deleteMany({
      where: { marketId: 'TEST:BTCUSD' },
    });
    await db.client.marketTicker.deleteMany({
      where: { marketId: 'TEST:BTCUSD' },
    });
    await db.client.rawMarketEnvelope.deleteMany({
      where: { marketId: 'TEST:BTCUSD' },
    });
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

  it('persists and reconstructs snapshot plus ordered deltas', async () => {
    const observed = SourceTimestamp.fromEpochMilliseconds('1700000000000');
    const level = (side: 'bid' | 'ask', price: string, quantity: string) => ({
      side,
      price: Price.from(price, 'TEST:BTCUSD'),
      quantity: Quantity.from(quantity, 'BTC-USD'),
    });
    const base: OrderBook = {
      venueId: 'TEST',
      marketId: 'TEST:BTCUSD',
      source: 'fixture',
      kind: 'snapshot',
      sequence: '1',
      bids: [level('bid', '100', '2')],
      asks: [level('ask', '101', '3')],
      time: eventTimepoint({
        eventTime: observed,
        receivedAt: observed,
        processedAt: observed,
      }),
    };
    const deltaTime = SourceTimestamp.fromEpochMilliseconds('1700000000001');
    const store = new MarketEventStore(db.client);
    expect(await store.storeOrderBook(base)).toBe(true);
    expect(
      await store.storeOrderBook({
        ...base,
        kind: 'delta',
        sequence: '2',
        previousSequence: '1',
        bids: [level('bid', '100', '1.5')],
        asks: [],
        time: eventTimepoint({
          eventTime: deltaTime,
          receivedAt: deltaTime,
          processedAt: deltaTime,
        }),
      }),
    ).toBe(true);
    await expect(
      store.reconstructOrderBook(
        'TEST:BTCUSD',
        new Date('2023-11-14T22:13:21Z'),
      ),
    ).resolves.toMatchObject({
      valid: true,
      sequence: '2',
      bids: [{ price: '100', quantity: '1.5' }],
      asks: [{ price: '101', quantity: '3' }],
    });
    const historical = new PostgreSqlHistoricalDataProvider(db.client);
    const ordered = await historical.queryOrderBooks({
      marketId: 'TEST:BTCUSD',
      from: SourceTimestamp.fromEpochMilliseconds('1699999999999'),
      to: SourceTimestamp.fromEpochMilliseconds('1700000000002'),
    });
    expect(ordered.map((event) => event.sequence)).toEqual(['1', '2']);
  });
});

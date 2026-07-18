import {
  eventTimepoint,
  Price,
  Quantity,
  SourceTimestamp,
} from '@quant-lab/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import type { OrderBook } from '@quant-lab/market-data';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MarketEventStore, ObservedOpportunityService } from '../../src';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const database = new DatabaseLifecycle();
const instrumentId = 'OPP-BTC-USD';
const binanceId = 'BINANCE:OPPBTCUSD';
const krakenId = 'KRAKEN:OPPXBTUSD';

describe('ObservedOpportunityService integration', () => {
  beforeAll(async () => {
    await database.connect();
    await database.client.observedOpportunity.deleteMany({
      where: { canonicalSymbol: 'OPP-BTC/USD' },
    });
    await database.client.marketOrderBookEvent.deleteMany({
      where: { marketId: { in: [binanceId, krakenId] } },
    });
    await database.client.rawMarketEnvelope.deleteMany({
      where: { marketId: { in: [binanceId, krakenId] } },
    });
    await database.client.market.deleteMany({
      where: { id: { in: [binanceId, krakenId] } },
    });
    await database.client.instrument.deleteMany({
      where: { id: instrumentId },
    });
    for (const venueId of ['BINANCE', 'KRAKEN'])
      await database.client.venue.upsert({
        where: { id: venueId },
        create: {
          id: venueId,
          code: venueId,
          name: venueId,
          kind: 'exchange',
          status: 'active',
        },
        update: {},
      });
    await database.client.instrument.create({
      data: {
        id: instrumentId,
        kind: 'spot',
        baseCurrency: 'OPP-BTC',
        quoteCurrency: 'USD',
        canonicalSymbol: 'OPP-BTC/USD',
      },
    });
    for (const [id, venueId] of [
      [binanceId, 'BINANCE'],
      [krakenId, 'KRAKEN'],
    ] as const)
      await database.client.market.create({
        data: {
          id,
          venueId,
          instrumentId,
          venueSymbol: id,
          status: 'active',
          spot: true,
          firstSeenAt: new Date('2026-07-18T00:00:00Z'),
          lastSeenAt: new Date('2026-07-18T00:00:00Z'),
        },
      });
    const store = new MarketEventStore(database.client);
    await store.storeOrderBook(snapshot(binanceId, 'BINANCE', '99', '100'));
    await store.storeOrderBook(snapshot(krakenId, 'KRAKEN', '101', '102'));
  });

  afterAll(() => database.disconnect());

  it('persists both directions with reproducible input references', async () => {
    const service = new ObservedOpportunityService(database.client);
    const configuration = {
      id: 'integration-observed',
      version: '1.0.0',
      maximumBookAgeMs: 1000,
      maximumCrossVenueSkewMs: 100,
      minimumObservedSpread: '0.001',
    };
    const results = await service.evaluateAll(
      configuration,
      new Date('2026-07-18T00:00:00.050Z'),
    );
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.classification).sort()).toEqual([
      'observed',
      'rejected',
    ]);
    const rows = await service.query({ canonicalSymbol: 'OPP-BTC/USD' });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.classification === 'observed')).toMatchObject(
      {
        observedSpread: '0.01',
        detector: { id: 'integration-observed', version: '1.0.0' },
      },
    );
    expect(
      rows.every((row) => row.classification !== ('executable' as string)),
    ).toBe(true);
  });
});

function snapshot(
  marketId: string,
  venueId: string,
  bid: string,
  ask: string,
): OrderBook {
  const observed = SourceTimestamp.fromEpochMilliseconds('1784332800000');
  return {
    venueId,
    marketId,
    source: 'fixture',
    kind: 'snapshot',
    sequence: '1',
    bids: [
      {
        side: 'bid',
        price: Price.from(bid, marketId),
        quantity: Quantity.from('1', instrumentId),
      },
    ],
    asks: [
      {
        side: 'ask',
        price: Price.from(ask, marketId),
        quantity: Quantity.from('1', instrumentId),
      },
    ],
    time: eventTimepoint({
      eventTime: observed,
      receivedAt: observed,
      processedAt: observed,
    }),
  };
}

import {
  eventTimepoint,
  Price,
  Quantity,
  SourceTimestamp,
} from '@quant-lab/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import type { OrderBook } from '@quant-lab/market-data';
import type { ExecutableDetectorConfig } from '@quant-lab/strategy-engine';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ExecutableOpportunityService, MarketEventStore } from '../../src';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const database = new DatabaseLifecycle();
const instrumentId = 'EXE-BTC-USD';
const binanceId = 'BINANCE:EXEBTCUSD';
const krakenId = 'KRAKEN:EXEXBTUSD';
const canonicalSymbol = 'EXE-BTC/USD';

const detectorConfig: ExecutableDetectorConfig = {
  id: 'integration-executable',
  version: '1.0.0',
  maximumBookAgeMs: 1_000,
  maximumCrossVenueSkewMs: 100,
  tradeSizes: ['1', '2'],
  slippageBufferRate: '0',
  latencyBufferMs: 250,
  minimumNetProfitRate: '0',
  inventory: {
    BINANCE: { USD: '1000000' },
    KRAKEN: { 'EXE-BTC': '1000' },
  },
};

async function cleanup(): Promise<void> {
  await database.client.executableOpportunity.deleteMany({
    where: { canonicalSymbol },
  });
  await database.client.marketOrderBookEvent.deleteMany({
    where: { marketId: { in: [binanceId, krakenId] } },
  });
  await database.client.rawMarketEnvelope.deleteMany({
    where: { marketId: { in: [binanceId, krakenId] } },
  });
  await database.client.feeScheduleVersion.deleteMany({
    where: { marketId: { in: [binanceId, krakenId] } },
  });
  await database.client.tradingRuleVersion.deleteMany({
    where: { marketId: { in: [binanceId, krakenId] } },
  });
  await database.client.market.deleteMany({
    where: { id: { in: [binanceId, krakenId] } },
  });
  await database.client.instrument.deleteMany({ where: { id: instrumentId } });
}

describe('ExecutableOpportunityService integration', () => {
  beforeAll(async () => {
    await database.connect();
    await cleanup();
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
        baseCurrency: 'EXE-BTC',
        quoteCurrency: 'USD',
        canonicalSymbol,
      },
    });
    const store = new MarketEventStore(database.client);
    for (const [id, venueId, bid, ask] of [
      [binanceId, 'BINANCE', '99', '100'],
      [krakenId, 'KRAKEN', '110', '111'],
    ] as const) {
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
      await database.client.feeScheduleVersion.create({
        data: {
          marketId: id,
          fingerprint: `${id}-fee`,
          maker: '0.0005',
          taker: '0.001',
          source: 'fixture',
          effectiveAt: new Date('2026-07-18T00:00:00Z'),
        },
      });
      await database.client.tradingRuleVersion.create({
        data: {
          marketId: id,
          fingerprint: `${id}-rule`,
          priceIncrement: '0.01',
          quantityIncrement: '0.0001',
          minimumQuantity: '0.0001',
          minimumNotional: '10',
          effectiveAt: new Date('2026-07-18T00:00:00Z'),
        },
      });
      await store.storeOrderBook(snapshot(id, venueId, bid, ask));
    }
  });

  afterAll(async () => {
    await cleanup();
    await database.disconnect();
  });

  it('persists executable opportunities with an exact profit breakdown', async () => {
    const service = new ExecutableOpportunityService(database.client);
    const results = await service.evaluateAll(
      detectorConfig,
      new Date('2026-07-18T00:00:00.050Z'),
    );
    expect(results).toHaveLength(2);
    const executable = results.find(
      (result) => result.classification === 'executable',
    );
    expect(executable).toBeDefined();
    expect(executable?.direction).toBe('buy-binance-sell-kraken');
    // buy 2 @ 100 = 200, sell 2 @ 110 = 220; gross 20.
    expect(executable?.grossProfit).toBe('20');
    expect(executable?.maxExecutableSize).toBe('2');

    const rows = await service.query({ canonicalSymbol });
    expect(rows).toHaveLength(2);
    const stored = rows.find((row) => row.classification === 'executable');
    expect(stored).toMatchObject({
      direction: 'buy-binance-sell-kraken',
      detector: { id: 'integration-executable', version: '1.0.0' },
    });
    expect(Array.isArray(stored?.sizeEvaluations)).toBe(true);
  });

  it('re-evaluation is idempotent for the same books and instant', async () => {
    const service = new ExecutableOpportunityService(database.client);
    await service.evaluateAll(
      detectorConfig,
      new Date('2026-07-18T00:00:00.060Z'),
    );
    await service.evaluateAll(
      detectorConfig,
      new Date('2026-07-18T00:00:00.060Z'),
    );
    const rows = await service.query({ canonicalSymbol, limit: 500 });
    const keys = rows.map(
      (row) => `${row.direction}:${row.buyBookEventId}:${row.evaluatedAt}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
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
        quantity: Quantity.from('50', instrumentId),
      },
    ],
    asks: [
      {
        side: 'ask',
        price: Price.from(ask, marketId),
        quantity: Quantity.from('50', instrumentId),
      },
    ],
    time: eventTimepoint({
      eventTime: observed,
      receivedAt: observed,
      processedAt: observed,
    }),
  };
}

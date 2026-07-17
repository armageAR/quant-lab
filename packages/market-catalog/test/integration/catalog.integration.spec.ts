import {
  FeeRate,
  Money,
  Quantity,
  SourceTimestamp,
  type Market,
  type Venue,
} from '@quant-lab/core';
import { DatabaseLifecycle } from '@quant-lab/database';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MarketCatalog, type MarketCatalogProvider } from '../../src';

loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const timestamp = SourceTimestamp.fromEpochMilliseconds('1700000000000');

class FixtureProvider implements MarketCatalogProvider {
  ruleIncrement = '0.01';

  constructor(
    readonly venue: Venue,
    public markets: Market[],
  ) {}

  listMarkets() {
    return Promise.resolve(this.markets);
  }

  getCapabilities() {
    return Promise.resolve({ balances: true, effectiveFees: true });
  }

  getTradingRules(marketId: string) {
    return Promise.resolve({
      marketId,
      priceIncrement: this.ruleIncrement,
      quantityIncrement: '0.000001',
      minimumQuantity: Quantity.from('0.00001', 'BTC-USD'),
      minimumNotional: Money.from('5', 'USD'),
      effectiveAt: timestamp,
    });
  }

  getEffectiveFees(marketIds: readonly string[] = []) {
    return Promise.resolve(
      marketIds.map((marketId) => ({
        venueId: this.venue.id,
        marketId,
        maker: FeeRate.from('0.001'),
        taker: FeeRate.from('0.002'),
        source: 'fixture',
        effectiveAt: timestamp,
      })),
    );
  }
}

const database = new DatabaseLifecycle();
const catalog = new MarketCatalog(database.client);
const binance = new FixtureProvider(
  {
    id: 'BINANCE',
    code: 'BINANCE',
    name: 'Binance',
    kind: 'exchange',
    status: 'active',
  },
  [
    {
      id: 'BINANCE:BTCUSD',
      venueId: 'BINANCE',
      instrumentId: 'BTC-USD',
      venueSymbol: 'BTC/USD',
      status: 'active',
      spot: true,
    },
  ],
);
const kraken = new FixtureProvider(
  {
    id: 'KRAKEN',
    code: 'KRAKEN',
    name: 'Kraken',
    kind: 'exchange',
    status: 'active',
  },
  [
    {
      id: 'KRAKEN:XXBTZUSD',
      venueId: 'KRAKEN',
      instrumentId: 'XBT-USD',
      venueSymbol: 'XBT/USD',
      status: 'active',
      spot: true,
    },
  ],
);

describe('MarketCatalog integration', () => {
  beforeAll(() => database.connect());
  afterAll(() => database.disconnect());

  beforeEach(async () => {
    binance.ruleIncrement = '0.01';
    binance.markets = [
      {
        id: 'BINANCE:BTCUSD',
        venueId: 'BINANCE',
        instrumentId: 'BTC-USD',
        venueSymbol: 'BTC/USD',
        status: 'active',
        spot: true,
      },
    ];
    await database.client.marketTicker.deleteMany();
    await database.client.marketTrade.deleteMany();
    await database.client.marketCandle.deleteMany();
    await database.client.orderBookInvalidation.deleteMany();
    await database.client.marketOrderBookEvent.deleteMany();
    await database.client.rawMarketEnvelope.deleteMany();
    await database.client.clockDriftMeasurement.deleteMany();
    await database.client.feeScheduleVersion.deleteMany();
    await database.client.tradingRuleVersion.deleteMany();
    await database.client.marketAlias.deleteMany();
    await database.client.capabilitySnapshot.deleteMany();
    await database.client.market.deleteMany();
    await database.client.instrument.deleteMany();
    await database.client.venue.deleteMany();
  });

  it('maps venue aliases to one instrument and returns comparable markets', async () => {
    await catalog.refresh([binance, kraken], ['BTC/USD']);
    const comparable = await catalog.listComparableActiveMarkets();

    expect(comparable).toHaveLength(2);
    expect(
      comparable.every((market) => market.canonicalSymbol === 'BTC/USD'),
    ).toBe(true);
    expect(await database.client.instrument.count()).toBe(1);
  });

  it('is idempotent and versions a precision change', async () => {
    await catalog.refresh([binance], ['BTC/USD']);
    await catalog.refresh([binance], ['BTC/USD']);
    expect(await database.client.tradingRuleVersion.count()).toBe(1);

    binance.ruleIncrement = '0.1';
    await catalog.refresh([binance], ['BTC/USD']);
    expect(await database.client.tradingRuleVersion.count()).toBe(2);
  });

  it('marks a missing market inactive without deleting history', async () => {
    await catalog.refresh([binance], ['BTC/USD']);
    binance.markets = [];
    await catalog.refresh([binance], ['BTC/USD']);

    const market = await database.client.market.findUniqueOrThrow({
      where: { id: 'BINANCE:BTCUSD' },
    });
    expect(market.status).toBe('inactive');
    expect(await database.client.tradingRuleVersion.count()).toBe(1);
  });
});

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
    id: 'TEST_BINANCE',
    code: 'TEST_BINANCE',
    name: 'Test Binance',
    kind: 'exchange',
    status: 'active',
  },
  [
    {
      id: 'TEST_BINANCE:BTCUSD',
      venueId: 'TEST_BINANCE',
      instrumentId: 'BTC-USD',
      venueSymbol: 'BTC/USD',
      status: 'active',
      spot: true,
    },
  ],
);
const kraken = new FixtureProvider(
  {
    id: 'TEST_KRAKEN',
    code: 'TEST_KRAKEN',
    name: 'Test Kraken',
    kind: 'exchange',
    status: 'active',
  },
  [
    {
      id: 'TEST_KRAKEN:XXBTZUSD',
      venueId: 'TEST_KRAKEN',
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
        id: 'TEST_BINANCE:BTCUSD',
        venueId: 'TEST_BINANCE',
        instrumentId: 'BTC-USD',
        venueSymbol: 'BTC/USD',
        status: 'active',
        spot: true,
      },
    ];
    const marketIds = ['TEST_BINANCE:BTCUSD', 'TEST_KRAKEN:XXBTZUSD'];
    const venueIds = ['TEST_BINANCE', 'TEST_KRAKEN'];
    await database.client.feeScheduleVersion.deleteMany({
      where: { marketId: { in: marketIds } },
    });
    await database.client.tradingRuleVersion.deleteMany({
      where: { marketId: { in: marketIds } },
    });
    await database.client.marketAlias.deleteMany({
      where: { marketId: { in: marketIds } },
    });
    await database.client.capabilitySnapshot.deleteMany({
      where: { venueId: { in: venueIds } },
    });
    await database.client.market.deleteMany({
      where: { id: { in: marketIds } },
    });
    await database.client.venue.deleteMany({ where: { id: { in: venueIds } } });
  });

  it('maps venue aliases to one instrument and returns comparable markets', async () => {
    await catalog.refresh([binance, kraken], ['BTC/USD']);
    const comparable = await catalog.listComparableActiveMarkets();

    const fixtures = comparable.filter((market) =>
      market.venueId.startsWith('TEST_'),
    );
    expect(fixtures).toHaveLength(2);
    expect(
      fixtures.every((market) => market.canonicalSymbol === 'BTC/USD'),
    ).toBe(true);
    expect(
      await database.client.instrument.count({
        where: { canonicalSymbol: 'BTC/USD' },
      }),
    ).toBe(1);
  });

  it('is idempotent and versions a precision change', async () => {
    await catalog.refresh([binance], ['BTC/USD']);
    await catalog.refresh([binance], ['BTC/USD']);
    expect(
      await database.client.tradingRuleVersion.count({
        where: { marketId: 'TEST_BINANCE:BTCUSD' },
      }),
    ).toBe(1);

    binance.ruleIncrement = '0.1';
    await catalog.refresh([binance], ['BTC/USD']);
    expect(
      await database.client.tradingRuleVersion.count({
        where: { marketId: 'TEST_BINANCE:BTCUSD' },
      }),
    ).toBe(2);
  });

  it('marks a missing market inactive without deleting history', async () => {
    await catalog.refresh([binance], ['BTC/USD']);
    binance.markets = [];
    await catalog.refresh([binance], ['BTC/USD']);

    const market = await database.client.market.findUniqueOrThrow({
      where: { id: 'TEST_BINANCE:BTCUSD' },
    });
    expect(market.status).toBe('inactive');
    expect(
      await database.client.tradingRuleVersion.count({
        where: { marketId: 'TEST_BINANCE:BTCUSD' },
      }),
    ).toBe(1);
  });
});

import {
  Price,
  Quantity,
  SourceTimestamp,
  eventTimepoint,
  type Instrument,
  type Market,
  type Venue,
} from '@quant-lab/core';

import type { Ticker, Trade } from './events';

export const contractFixture = {
  venue: {
    id: 'VENUE-TEST',
    code: 'TEST',
    name: 'Contract Test Venue',
    kind: 'exchange',
    status: 'active',
  } satisfies Venue,
  instrument: {
    id: 'BTC-USD',
    kind: 'spot',
    baseCurrency: 'BTC',
    quoteCurrency: 'USD',
    canonicalSymbol: 'BTC/USD',
  } satisfies Instrument,
  market: {
    id: 'TEST-BTC-USD',
    venueId: 'VENUE-TEST',
    instrumentId: 'BTC-USD',
    venueSymbol: 'XBTUSD',
    status: 'active',
    spot: true,
  } satisfies Market,
};

export function tickerFixture(overrides: Partial<Ticker> = {}): Ticker {
  const observedAt = SourceTimestamp.fromEpochMicroseconds('1700000000123456');
  return {
    venueId: contractFixture.venue.id,
    marketId: contractFixture.market.id,
    source: 'contract-fixture',
    time: eventTimepoint({
      eventTime: observedAt,
      receivedAt: observedAt,
      processedAt: observedAt,
      sequence: '1',
    }),
    bid: Price.from('42000.01', contractFixture.market.id),
    ask: Price.from('42000.02', contractFixture.market.id),
    ...overrides,
  };
}

export function tradeFixture(overrides: Partial<Trade> = {}): Trade {
  const observedAt = SourceTimestamp.fromEpochMicroseconds('1700000000123456');
  return {
    venueId: contractFixture.venue.id,
    marketId: contractFixture.market.id,
    source: 'contract-fixture',
    time: eventTimepoint({
      eventTime: observedAt,
      receivedAt: observedAt,
      processedAt: observedAt,
      sequence: '2',
    }),
    tradeId: 'trade-1',
    side: 'buy',
    price: Price.from('42000.02', contractFixture.market.id),
    quantity: Quantity.from('0.125', contractFixture.instrument.id),
    ...overrides,
  };
}

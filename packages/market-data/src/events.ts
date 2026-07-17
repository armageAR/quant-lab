import type {
  EventTimepoint,
  Price,
  Quantity,
  SourceTimestamp,
} from '@quant-lab/core';

export type TradeSide = 'buy' | 'sell';
export type OrderBookSide = 'bid' | 'ask';
export type OrderBookKind = 'snapshot' | 'delta';

export interface MarketEvent {
  venueId: string;
  marketId: string;
  time: EventTimepoint;
  source: string;
}

export interface Ticker extends MarketEvent {
  bid?: Price;
  bidQuantity?: Quantity;
  ask?: Price;
  askQuantity?: Quantity;
  last?: Price;
}

export interface Trade extends MarketEvent {
  tradeId: string;
  side: TradeSide;
  price: Price;
  quantity: Quantity;
}

export interface Candle extends MarketEvent {
  interval: string;
  openedAt: SourceTimestamp;
  closedAt: SourceTimestamp;
  open: Price;
  high: Price;
  low: Price;
  close: Price;
  volume: Quantity;
  tradeCount?: string;
}

export interface OrderBookLevel {
  side: OrderBookSide;
  price: Price;
  quantity: Quantity;
}

export interface OrderBook extends MarketEvent {
  kind: OrderBookKind;
  sequence: string;
  previousSequence?: string;
  bids: readonly OrderBookLevel[];
  asks: readonly OrderBookLevel[];
  checksum?: string;
}

export interface ClockDriftSample {
  venueId: string;
  sampledAt: SourceTimestamp;
  serverTime: SourceTimestamp;
  driftMicroseconds: string;
  roundTripMicroseconds: string;
}

export interface RawSourceEnvelope {
  venueId: string;
  channel: string;
  receivedAt: SourceTimestamp;
  contentType: string;
  payload: string;
  checksum: string;
  schemaVersion: string;
}

export interface DatasetReference {
  id: string;
  version: string;
  checksum: string;
  from: SourceTimestamp;
  to: SourceTimestamp;
  eventCount: string;
  format: string;
  sizeBytes?: string;
}

export interface Pagination {
  limit?: number;
  cursor?: string;
}

export interface TimeRange {
  from?: SourceTimestamp;
  to?: SourceTimestamp;
}

import type { DecimalString, FeeRate, Money, Price, Quantity } from './decimal';
import type { SourceTimestamp } from './time';

export type VenueKind = 'exchange' | 'broker';
export type VenueStatus = 'active' | 'degraded' | 'inactive';
export type InstrumentKind = 'spot' | 'future' | 'option' | 'equity' | 'forex';
export type MarketStatus = 'active' | 'inactive' | 'delisted';

export interface Venue {
  id: string;
  code: string;
  name: string;
  kind: VenueKind;
  status: VenueStatus;
}

export interface Instrument {
  id: string;
  kind: InstrumentKind;
  baseCurrency: string;
  quoteCurrency: string;
  canonicalSymbol: string;
}

export interface Market {
  id: string;
  venueId: string;
  instrumentId: string;
  venueSymbol: string;
  status: MarketStatus;
  spot: boolean;
}

export interface TradingRules {
  marketId: string;
  priceIncrement: DecimalString;
  quantityIncrement: DecimalString;
  minimumQuantity?: Quantity;
  minimumNotional?: Money;
  maximumQuantity?: Quantity;
  effectiveAt: SourceTimestamp;
}

export interface FeeSnapshot {
  venueId: string;
  marketId?: string;
  tier?: string;
  maker: FeeRate;
  taker: FeeRate;
  effectiveAt: SourceTimestamp;
  source: string;
}

export interface Balance {
  currency: string;
  available: Money;
  locked: Money;
  total: Money;
  observedAt: SourceTimestamp;
}

export interface PricedQuantity {
  price: Price;
  quantity: Quantity;
}

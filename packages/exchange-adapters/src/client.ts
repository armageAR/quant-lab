export interface CcxtMarket {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  spot?: boolean;
  active?: boolean;
  maker?: string | number;
  taker?: string | number;
  precision?: { price?: string | number; amount?: string | number };
  limits?: {
    amount?: { min?: string | number; max?: string | number };
    cost?: { min?: string | number; max?: string | number };
  };
}

export interface CcxtBalance {
  free?: Record<string, string | number | undefined>;
  used?: Record<string, string | number | undefined>;
  total?: Record<string, string | number | undefined>;
}

export interface CcxtTradingFee {
  symbol?: string;
  maker?: string | number;
  taker?: string | number;
}
export interface CcxtTicker {
  timestamp?: number;
  bid?: string;
  bidVolume?: string;
  ask?: string;
  askVolume?: string;
  last?: string;
}
export interface CcxtTrade {
  id: string;
  timestamp?: number;
  side?: string;
  price: string;
  amount: string;
}
export type CcxtCandle = [number, string, string, string, string, string];

export interface ReadOnlyCcxtClient {
  readonly id: string;
  readonly has: Record<string, boolean | string | undefined>;
  loadMarkets(reload?: boolean): Promise<Record<string, CcxtMarket>>;
  fetchTime(): Promise<string | number>;
  fetchBalance(): Promise<CcxtBalance>;
  fetchTradingFees(): Promise<Record<string, CcxtTradingFee>>;
  fetchTicker(symbol: string): Promise<CcxtTicker>;
  fetchTrades(
    symbol: string,
    since?: number,
    limit?: number,
  ): Promise<CcxtTrade[]>;
  fetchOHLCV(
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number,
  ): Promise<CcxtCandle[]>;
  inspectPermissions(): Promise<unknown>;
  close(): Promise<void>;
}

export type ReadOnlyCcxtClientFactory = (
  config: VenueAdapterConfig,
) => ReadOnlyCcxtClient;
import type { VenueAdapterConfig } from './config';

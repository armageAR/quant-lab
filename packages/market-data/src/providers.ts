import type {
  Balance,
  FeeSnapshot,
  Market,
  SourceTimestamp,
  TradingRules,
  Venue,
} from '@quant-lab/core';

import type {
  Candle,
  ClockDriftSample,
  DatasetReference,
  OrderBook,
  Pagination,
  Ticker,
  TimeRange,
  Trade,
} from './events';

export interface ProviderSubscription extends AsyncDisposable {
  readonly closed: boolean;
}

export interface ProviderCapabilities {
  rest: boolean;
  streaming: boolean;
  authenticatedAccountReads: boolean;
  historicalData: boolean;
  serverTime: boolean;
}

export interface MarketDataProvider {
  readonly venue: Venue;
  getCapabilities(): Promise<ProviderCapabilities>;
  listMarkets(): Promise<readonly Market[]>;
  getTradingRules(marketId: string): Promise<TradingRules>;
  getFeeSnapshot(marketId?: string): Promise<FeeSnapshot>;
  getServerTime(): Promise<ClockDriftSample>;
  fetchTicker(marketId: string): Promise<Ticker>;
  fetchOrderBook(marketId: string, depth?: number): Promise<OrderBook>;
  fetchTrades(
    marketId: string,
    range?: TimeRange & Pagination,
  ): Promise<readonly Trade[]>;
  fetchCandles(
    marketId: string,
    interval: string,
    range?: TimeRange & Pagination,
  ): Promise<readonly Candle[]>;
  subscribeTickers(
    marketIds: readonly string[],
    onTicker: (ticker: Ticker) => void | Promise<void>,
  ): Promise<ProviderSubscription>;
  subscribeOrderBooks(
    marketIds: readonly string[],
    onOrderBook: (orderBook: OrderBook) => void | Promise<void>,
  ): Promise<ProviderSubscription>;
}

export interface AccountReadCapabilities {
  balances: boolean;
  effectiveFees: boolean;
  accountStatus: boolean;
  credentialPermissions: boolean;
}

export interface CredentialPermissions {
  read: boolean;
  trade: boolean;
  withdraw: boolean;
  observedAt: SourceTimestamp;
}

export interface AccountStatus {
  accountId?: string;
  enabled: boolean;
  permissions: CredentialPermissions;
  observedAt: SourceTimestamp;
}

export interface AuthenticatedAccountReadProvider {
  readonly venue: Venue;
  getCapabilities(): Promise<AccountReadCapabilities>;
  getAccountStatus(accountId?: string): Promise<AccountStatus>;
  getBalances(accountId?: string): Promise<readonly Balance[]>;
  getEffectiveFees(
    marketIds?: readonly string[],
  ): Promise<readonly FeeSnapshot[]>;
}

export interface HistoricalQuery extends TimeRange, Pagination {
  marketId: string;
}

export interface HistoricalCandleQuery extends HistoricalQuery {
  interval: string;
}

export interface HistoricalDataProvider {
  queryCandles(query: HistoricalCandleQuery): Promise<readonly Candle[]>;
  queryTrades(query: HistoricalQuery): Promise<readonly Trade[]>;
  queryOrderBooks(query: HistoricalQuery): Promise<readonly OrderBook[]>;
  getDataset(reference: string): Promise<DatasetReference>;
}

# Providers

This document defines the provider boundaries implemented by `@quant-lab/market-data`. Concrete venue adapters may extend their behavior only without leaking venue SDK types into these contracts.

## MarketDataProvider

```ts
interface MarketDataProvider {
  readonly venue: Venue;
  getCapabilities(): Promise<ProviderCapabilities>;
  listMarkets(): Promise<readonly Market[]>;
  getTradingRules(marketId: string): Promise<TradingRules>;
  getFeeSnapshot(marketId?: string): Promise<FeeSnapshot>;
  getServerTime(): Promise<ClockDriftSample>;
  fetchTicker(marketId: string): Promise<Ticker>;
  fetchOrderBook(marketId: string, depth?: number): Promise<OrderBook>;
  fetchTrades(marketId: string, range?: TimeRange & Pagination): Promise<readonly Trade[]>;
  fetchCandles(marketId: string, interval: string, range?: TimeRange & Pagination): Promise<readonly Candle[]>;
  subscribeTickers(marketIds: readonly string[], onTicker: EventHandler<Ticker>): Promise<ProviderSubscription>;
  subscribeOrderBooks(marketIds: readonly string[], onOrderBook: EventHandler<OrderBook>): Promise<ProviderSubscription>;
}
```

## AuthenticatedAccountReadProvider

```ts
interface AuthenticatedAccountReadProvider {
  readonly venue: Venue;
  getCapabilities(): Promise<AccountReadCapabilities>;
  getAccountStatus(accountId?: string): Promise<AccountStatus>;
  getBalances(accountId?: string): Promise<readonly Balance[]>;
  getEffectiveFees(marketIds?: readonly string[]): Promise<readonly FeeSnapshot[]>;
}
```

This Phase 2 contract intentionally has no order creation, cancellation, transfer, or withdrawal method. Execution remains a separate future capability and cannot be reached through authenticated account reads.

## HistoricalDataProvider

```ts
interface HistoricalDataProvider {
  queryCandles(query: HistoricalCandleQuery): Promise<readonly Candle[]>;
  queryTrades(query: HistoricalQuery): Promise<readonly Trade[]>;
  queryOrderBooks(query: HistoricalQuery): Promise<readonly OrderBook[]>;
  getDataset(reference: string): Promise<DatasetReference>;
}
```

## Architectural notes

- `MarketDataProvider` owns live or near-live market access.
- `HistoricalDataProvider` owns read access to curated historical datasets.
- `AuthenticatedAccountReadProvider` owns read-only account state, credential permission, and effective-fee access.
- Execution will use a different provider boundary in a later phase.
- A single venue may implement more than one provider.
- Crypto exchanges, brokers, paper trading, and simulation adapters should all fit these contracts where practical.
- Provider outputs should be normalized before reaching strategy logic.
- Failures use typed `ProviderError` metadata; adapters must not attach credentials or complete raw payloads to errors.

# Providers

This document defines the intended provider contracts. These interfaces are architectural agreements and may evolve during implementation.

## MarketDataProvider

```ts
interface MarketDataProvider {
  listMarkets(): Promise<Market[]>;
  getMarketMetadata(marketId: string): Promise<MarketMetadata>;
  fetchTicker(marketId: string): Promise<Ticker>;
  subscribeToTickers(
    marketIds: string[],
    onTicker: (ticker: Ticker) => void,
  ): AsyncDisposable | Promise<AsyncDisposable>;
  fetchOrderBook(marketId: string, depth?: number): Promise<OrderBook>;
  subscribeToOrderBooks(
    marketIds: string[],
    onOrderBook: (orderBook: OrderBook) => void,
  ): AsyncDisposable | Promise<AsyncDisposable>;
  fetchTrades(
    marketId: string,
    options?: { since?: Date; limit?: number },
  ): Promise<Trade[]>;
  fetchCandles(
    marketId: string,
    interval: string,
    options?: { since?: Date; limit?: number },
  ): Promise<Candle[]>;
  getServerTime(): Promise<{ serverTime: Date; offsetMs?: number }>;
  getCapabilities(): Promise<MarketDataCapabilities>;
}
```

## ExecutionProvider

```ts
interface ExecutionProvider {
  getBalances(accountId?: string): Promise<Balance[]>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  cancelOrder(orderId: string): Promise<Order>;
  getOpenOrders(accountId?: string): Promise<Order[]>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;
  getFills(orderId?: string): Promise<Fill[]>;
  getTradingRules(marketId: string): Promise<TradingRules>;
  getCapabilities(): Promise<ExecutionCapabilities>;
}
```

## HistoricalDataProvider

```ts
interface HistoricalDataProvider {
  queryCandles(input: HistoricalCandleQuery): Promise<Candle[]>;
  queryTrades(input: HistoricalTradeQuery): Promise<Trade[]>;
  queryOrderBookSnapshots(
    input: HistoricalOrderBookQuery,
  ): Promise<OrderBook[]>;
  readNormalizedDataset(input: HistoricalDatasetQuery): Promise<NormalizedDataset>;
}
```

## Architectural notes

- `MarketDataProvider` owns live or near-live market access.
- `HistoricalDataProvider` owns read access to curated historical datasets.
- `ExecutionProvider` owns order placement and account state access.
- A single venue may implement more than one provider.
- Crypto exchanges, brokers, paper trading, and simulation adapters should all fit these contracts where practical.
- Provider outputs should be normalized before reaching strategy logic.

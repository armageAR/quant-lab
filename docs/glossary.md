# Glossary

| Term | Definition |
| --- | --- |
| Exchange | A trading venue that matches buy and sell orders for listed markets. |
| Broker | An intermediary that routes orders to markets or contracts on behalf of an account. |
| Venue | A generic term for an exchange or broker that can provide market data, execution, or both. |
| Instrument | A tradable asset or contract such as a spot pair, stock, ETF, future, or option. |
| Market | A venue-specific listing where an instrument can be traded. |
| Symbol | The venue or internal identifier used to reference a market or instrument. |
| Base currency | The first currency in a pair; the asset being bought or sold. |
| Quote currency | The currency used to price the base asset. |
| Ticker | A current quote snapshot that usually includes bid, ask, and last trade information. |
| Trade | A recorded executed transaction between a buyer and a seller. |
| Candle | An OHLCV bar aggregated over a fixed interval. |
| Order book | The ordered set of current bids and asks for a market. |
| Bid | A buy order or quoted buy price in the order book. |
| Ask | A sell order or quoted sell price in the order book. |
| Spread | The difference between the best ask and the best bid. |
| Depth | The amount of liquidity available across order-book levels. |
| Slippage | The difference between an expected price and the actual executable price. |
| Latency | The delay between data generation, decision making, and execution. |
| Opportunity | A candidate trading situation that may be profitable under certain assumptions. |
| Arbitrage opportunity | A price discrepancy that may be exploited by buying one venue and selling another or by other market-neutral structures. |
| Observed profit | The profit implied by visible prices before fees, depth, latency, and execution constraints. |
| Executable profit | The profit that remains after costs and constraints are modeled realistically. |
| Signal | A strategy output that expresses intent or action. |
| Strategy | A systematic trading logic or decision rule. |
| Strategy version | An immutable published version of a strategy implementation and configuration schema. |
| Experiment | A reproducible research run with explicit inputs and recorded outcomes. |
| Backtest | A simulation of a strategy over historical data. |
| Simulation | A runtime model that replays market conditions and execution assumptions. |
| Paper trading | Simulated execution against live or replayed data without sending real orders. |
| Live execution | The act of routing orders to a real venue or broker. |
| Order | An instruction to buy or sell an instrument under defined terms. |
| Fill | A partial or complete execution of an order. |
| Partial fill | A fill that executes only part of the requested order quantity. |
| Position | The net holding in an instrument after orders and fills are applied. |
| Portfolio | The aggregate set of balances, positions, and exposure for an account or strategy. |
| Balance | The available and reserved amount of a currency in an account. |
| Fee schedule | The documented maker, taker, withdrawal, and related cost structure for a venue. |
| Risk rule | A constraint that limits size, exposure, loss, or execution behavior. |
| MarketDataProvider | An architectural contract that supplies live or near-live market data. |
| ExecutionProvider | An architectural contract that creates, cancels, and inspects orders and account state. |
| CCXT | A library that normalizes exchange integrations and common market/execution operations. |
| IBKR | Interactive Brokers, a future broker integration target for Quant Lab. |

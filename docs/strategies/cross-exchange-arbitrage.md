# Cross-Exchange Arbitrage

## Hypothesis

Price differences between Binance and Kraken may create short-lived arbitrage opportunities. The strategy must test whether an observed spread is actually executable after fees, depth, latency, and transfer or inventory constraints are considered.

## Required data

- best bid and best ask across both venues;
- full or partial order-book depth;
- recent trades;
- ticker timestamps;
- fee schedules;
- minimum order sizes and precision rules;
- market status and trading availability;
- latency measurements between feed, decision, and execution paths.

## Opportunity calculation

An opportunity should compare:

- observed spread;
- executable spread after consuming the order book;
- estimated maker/taker fees;
- slippage from the intended size;
- any transfer or inventory cost.

Observed profit is only the starting point. Executable profit is the metric that matters.

## Fee calculation

Fee calculations must use the venue fee schedule in effect for the run or research period. When fee metadata is unavailable, the model should fall back to explicit configuration rather than guessed defaults.

## Slippage and depth

The strategy must estimate the price impact of taking size from the order book. If the size exceeds available depth at attractive prices, the remaining quantity should be repriced across deeper levels.

## Latency

Latency matters because an observed spread can disappear before execution completes. The strategy should capture:

- market data freshness;
- transport delay;
- order placement delay;
- confirmation delay.

## Transfer assumptions

Cross-exchange arbitrage may rely on transfers, but transfer delays and withdrawal restrictions can make a spread non-executable in practice. Inventory-based arbitrage, where balances are already present on both venues, is often more realistic.

## Inventory-based arbitrage

Inventory-based arbitrage assumes capital already exists on both venues, allowing one side to buy while the other side sells without waiting for transfers. This reduces transfer risk but introduces inventory rebalancing and exposure management requirements.

## Risks

- stale market data;
- hidden fees;
- minimum order constraints;
- precision mismatches;
- partial fills;
- market movement during execution;
- queue position and book depletion;
- transfer delays;
- regulatory or account restrictions.

## Invalid assumptions

- assuming the midpoint is tradable;
- assuming the top of book is fully available;
- assuming both venues update at the same time;
- assuming fees are negligible;
- assuming a spread is executable because it exists in a ticker snapshot.

## Backtesting limitations

Backtests should not assume the observed spread was executable unless the fill model proves it. Historical order-book snapshots, timestamps, and fee data are needed to estimate realistic results.

## Paper-trading requirements

Before any live execution, the strategy should be able to:

- consume live or replayed feeds;
- compute opportunity and executable profit;
- simulate fills against order-book depth;
- track balances and positions;
- record rejected and missed opportunities;
- compare observed profit to realized profit.

## Success metrics

- percentage of detected opportunities that remain executable after costs;
- realized net profit;
- fill rate;
- average and worst-case slippage;
- latency distribution;
- number of false positives;
- stability across different market regimes.

## Why an observed spread may not be executable

A spread may disappear because one venue updates faster, the order book is too shallow, fees erase the edge, the account lacks inventory, the order is too large for available depth, or the transfer window is too slow. The strategy must treat all of these as first-class failure modes rather than edge cases.

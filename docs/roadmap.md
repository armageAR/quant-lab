# Roadmap

## Phase 0: Repository foundation

Scope:
- repository structure;
- documentation;
- conventions;
- decision records;
- local development setup.

Completion indicators:
- repository layout exists and is documented;
- key terminology is defined;
- architecture decisions are recorded in ADRs;
- local development expectations are written down.

## Phase 1: Platform skeleton

Scope:
- pnpm workspace;
- Turborepo;
- NestJS API;
- worker;
- Next.js dashboard;
- PostgreSQL;
- Prisma;
- Docker;
- logging and configuration.

Completion indicators:
- workspace boots locally;
- API, worker, and dashboard start in development mode;
- configuration is validated;
- logs are structured;
- database connectivity and migrations are in place.

## Phase 2: Market data foundation

Scope:
- `MarketDataProvider`;
- Binance connector;
- Kraken connector;
- symbol normalization;
- ticker ingestion;
- order-book ingestion;
- candle ingestion;
- persistence;
- historical data access.

Completion indicators:
- market metadata is normalized internally;
- ticker, order-book, and candle data can be collected;
- historical queries work against persisted data;
- provider contracts are documented and used consistently.

## Phase 3: Arbitrage research

Scope:
- cross-exchange market comparison;
- opportunity detection;
- fee modeling;
- slippage modeling;
- order-book depth;
- latency measurements;
- opportunity persistence;
- dashboard visibility;
- research reports.

Completion indicators:
- Binance and Kraken can be compared on the same instrument set;
- observed and executable opportunities are distinguished;
- research runs are persisted with parameters and results;
- dashboard views expose the relevant analysis.

## Phase 4: Backtesting and simulation

Scope:
- deterministic backtesting;
- simulation clock;
- historical replay;
- realistic fill models;
- fees;
- slippage;
- partial fills;
- experiment persistence;
- reproducible results;
- performance metrics.

Completion indicators:
- the same dataset and parameters reproduce the same run;
- fill assumptions are explicit;
- experiment metadata includes code version and dataset range;
- results can be reviewed and compared across runs.

## Phase 5: Paper trading

Scope:
- live market feed with simulated execution;
- balances;
- orders;
- fills;
- positions;
- portfolios;
- risk limits;
- operator controls.

Completion indicators:
- paper trading uses live or replayed market inputs;
- order lifecycle is visible end-to-end;
- balances and positions evolve consistently;
- risk limits can block simulated execution.

## Phase 6: Strategy engine

Scope:
- plugin architecture;
- configuration schemas;
- strategy lifecycle;
- signal generation;
- experiment management;
- version tracking;
- portfolio rules.

Completion indicators:
- strategies can be loaded and versioned independently;
- configuration is schema-validated;
- experiments can be traced back to a strategy version and commit SHA;
- portfolio rules can constrain signals before execution.

## Phase 7: Controlled live execution

Scope:
- explicit feature flag;
- exchange credentials;
- order validation;
- risk gates;
- kill switch;
- audit logs;
- reconciliation;
- alerts;
- no unattended execution by default.

Completion indicators:
- live execution is disabled unless explicitly enabled;
- every live order is auditable;
- reconciliation identifies mismatches;
- alerts and kill-switch behavior are documented and testable;
- human approval is required for initial deployment to live execution.

## Phase 8: Market and broker expansion

Scope:
- Coinbase;
- OKX;
- Bybit;
- IBKR;
- stocks;
- ETFs;
- forex;
- futures;
- options.

Completion indicators:
- the venue abstraction can support non-crypto assets;
- new venues can be added without strategy rewrites;
- instrument normalization supports broker-style contracts;
- market-hours and account-model differences are handled explicitly.

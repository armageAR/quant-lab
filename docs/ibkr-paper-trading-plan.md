# IBKR stocks and ETFs paper-trading plan

## Status

Planned. This plan extends Phase 6 after the strategy plugin foundation. It does
not authorize live orders.

## Objective

Add Interactive Brokers as a broker provider for US-listed stocks and ETFs,
using real market and account data for research, deterministic backtests, and
paper trading. Preserve the existing Binance/Kraken workflow unchanged.

The first useful outcome is a complete operator flow:

1. connect Quant Lab to an IBKR paper account;
2. discover and allowlist supported stocks and ETFs;
3. ingest session-aware real-time and historical data;
4. run a versioned strategy through backtest;
5. submit simulated intents to the local paper engine and, separately, to the
   IBKR paper simulator;
6. reconcile both simulations and produce a validation report.

## Scope

- One IBKR account owned by the single operator.
- IB Gateway as the primary long-running API runtime; TWS remains a supported
  diagnostic runtime.
- TWS API connection to the IBKR paper environment only.
- US-listed common stocks and ETFs, initially USD-settled.
- A small explicit allowlist such as `SPY`, `QQQ`, `AAPL`, and `MSFT`; final
  symbols are configuration, not source defaults.
- Contract discovery, market data, account snapshots, positions, paper orders,
  fills, cancellation, and reconciliation.
- Regular trading hours first. Extended-hours behavior is a later opt-in.
- Existing exact-decimal, timestamp, lineage, risk, logging, and audit rules.

## Explicitly deferred

- Live IBKR order submission.
- ADRs, ordinary-share conversions, CEDEARs, BYMA, Argentine brokers, MEP, and
  cable settlement.
- Options, futures, forex, bonds, CFDs, fractional shares, and margin strategies.
- Short selling until borrow availability and borrow cost are modeled.
- Smart-routing optimization and direct exchange routing.
- Unattended promotion from backtest or paper trading.

## Architectural decisions required

Before implementation, record an ADR covering:

- TWS API and IB Gateway as infrastructure dependencies;
- separation of IBKR live credentials from paper-session credentials;
- stable identity based on IBKR `conId`, with symbol and exchange treated as
  mutable/display metadata;
- session calendars, time zones, settlement currency, primary exchange, lot
  size, tick rules, and corporate-action versioning;
- separation between the local deterministic paper engine and the IBKR paper
  simulator;
- reconnect, pacing, request-ID, order-ID, and uncertain-result semantics.

IBKR SDK objects must remain inside the adapter. Core, strategies, simulation,
paper trading, API, and dashboard consume provider-neutral contracts.

## Delivery order

Phase 6.1 and 6.2 remain prerequisites. Strategy configuration and identity must
be stable before an additional broker is introduced.

### Sprint 6.3: IBKR paper connectivity and contract catalog

**Goal:** prove safe, authenticated connectivity without creating an order.

Tasks:

- Create `packages/ibkr-adapter` behind existing provider contracts.
- Add configuration for host, paper port, client ID, account allowlist, timeout,
  reconnect, pacing, and an `IBKR_PAPER_ENABLED=false` safety flag.
- Reject known live ports and live-account responses in paper-only mode.
- Connect through IB Gateway and expose connection, server time, account ID,
  permissions, subscriptions, and session diagnostics.
- Discover contracts by `conId`; persist symbol, security type, currency,
  exchange, primary exchange, local symbol, tick size, lot size, and trading
  hours as versioned metadata.
- Add a read-only connectivity command and a dashboard health panel.
- Add mocked contract tests and opt-in credential-backed integration tests.

Acceptance:

- One command verifies an IBKR paper session without placing or cancelling an
  order.
- Live endpoints/accounts fail closed.
- Ambiguous symbols cannot enter the catalog without an explicit `conId`.
- Logs and API responses contain no credentials or sensitive account details.

### Sprint 6.4: Session-aware market-data ingestion

**Goal:** create auditable datasets for stocks and ETFs.

Tasks:

- Add snapshots/streaming for bid, ask, last, trades, and supported depth.
- Add bounded historical bars and preserve IBKR request provenance.
- Model exchange time zone, regular session, holidays, early closes, market
  state, and optional extended hours.
- Persist `eventTime`, `receivedAt`, and `processedAt`, source precision,
  request latency, gaps, pacing warnings, and reconnects.
- Apply the configured `IBKR_INSTRUMENTS` allowlist at ingestion and strategy
  boundaries.
- Add corporate-action and contract-metadata change detection; block datasets
  spanning unresolved adjustments.
- Extend dataset creation and validation for session-based instruments.

Acceptance:

- A sustained test ingests only allowlisted contracts and survives a forced
  Gateway reconnect without duplicate events.
- Historical and real-time events resolve to the same stable instrument.
- Closed-market periods are represented as sessions, not ingestion failures.
- Datasets identify adjustment, gap, timezone, and subscription limitations.

### Sprint 6.5: Stocks/ETFs backtest and local paper trading

**Goal:** exercise provider-neutral strategies without sending broker orders.

Tasks:

- Add a reference long-only stocks/ETFs strategy plugin; do not label it
  arbitrage unless it has multiple economically linked legs.
- Extend simulation for equity tick sizes, lots, sessions, USD cash, market and
  limit orders, partial fills, commissions, and settlement-aware buying power.
- Extend paper accounts from venue/currency inventory to cash plus positions.
- Add risk rules for maximum position, order notional, daily loss, concentration,
  stale quotes, session state, duplicate intent, and unsupported short sales.
- Expose IBKR datasets, experiments, runs, positions, PnL, and risk blocks in the
  existing dashboard workflows.
- Prove that the IBKR adapter's order methods are unreachable in local-paper
  mode.

Acceptance:

- A versioned strategy can run from an IBKR dataset through backtest and local
  paper trading with immutable provenance.
- Cash, positions, realized/unrealized PnL, fees, and ledger entries reconcile
  exactly.
- Orders outside session, allowlist, permissions, or risk limits are blocked.
- Binance/Kraken tests and paper workflows remain unchanged.

### Sprint 6.6: IBKR paper routing and reconciliation campaign

**Goal:** validate adapter lifecycle semantics against IBKR's simulator while
keeping the local model as an independent control.

Tasks:

- Implement an `IbkrPaperExecutionProvider` enabled only by a separate explicit
  flag and confirmed paper-account identity.
- Persist intent, IBKR order ID, permanent ID, acknowledgements, status changes,
  partial fills, commissions, cancellations, errors, and reconciliation events.
- Use deterministic client intent IDs and recover open orders after restart.
- Reconcile IBKR paper orders, executions, cash, and positions against local
  state; never retry an uncertain submission blindly.
- Run the same eligible signals through local simulation and IBKR paper routing
  as separate campaigns, not duplicate orders in one portfolio.
- Add pause, stop, emergency stop, stale-session detection, Gateway-disconnect
  behavior, alerts, and an incident runbook.
- Complete a bounded campaign with predefined duration, sample count, symbols,
  capital, and loss limits. Produce a manual go/no-go report.

Acceptance:

- Restart and reconnect do not duplicate IBKR paper orders.
- Every broker-side paper order maps to one approved local intent.
- Injected order, fill, cash, and position mismatches are detected.
- The report compares local expected fills with IBKR simulated fills and states
  the simulator's known limitations.
- Completion never enables or recommends live execution automatically.

## Configuration boundary

Names are finalized during Sprint 6.3, but the safe configuration surface must
include:

```env
IBKR_CONNECTIVITY_ENABLED=false
IBKR_PAPER_ENABLED=false
IBKR_PAPER_EXECUTION_ENABLED=false
IBKR_HOST=127.0.0.1
IBKR_PORT=
IBKR_CLIENT_ID=
IBKR_ACCOUNT_ID=
IBKR_INSTRUMENTS=
IBKR_REGULAR_TRADING_HOURS_ONLY=true
LIVE_EXECUTION_ENABLED=false
```

There is no default account, port, instrument, or permission that could route an
order. Secrets and account identifiers remain server-only.

## Operator prerequisites

- Active and funded IBKR live account with its associated paper account.
- Separate paper username and verified paper login.
- Market-data subscriptions for each selected exchange/instrument.
- IB Gateway installed and manually configured for API access.
- Written inventory of account permissions and subscribed data.
- Agreement on the initial 3-5 liquid USD instruments before Sprint 6.4.

## Validation gates

An IBKR capability advances only in this order:

1. mocked adapter contracts;
2. read-only paper connectivity;
3. contract and market-data validation;
4. deterministic historical backtest;
5. local paper trading;
6. IBKR paper routing;
7. reconciliation campaign;
8. explicit architecture and risk review.

Live IBKR execution belongs to a future controlled-execution plan and requires
new approval, credentials, limits, reconciliation evidence, and kill-switch
tests. Passing this plan is necessary but not sufficient.

## Definition of Done

- All four sprints satisfy their acceptance criteria and the repository
  Definition of Done.
- The supported quality gate and database integration suite pass.
- Paper-account evidence is recorded without secrets.
- Documentation explains Gateway startup, health, troubleshooting, market-data
  subscriptions, dashboard operation, and recovery.
- Existing crypto behavior has regression coverage.
- ADR and Argentine-market behavior is neither modeled implicitly nor presented
  as supported.

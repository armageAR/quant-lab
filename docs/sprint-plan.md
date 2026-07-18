# Project Review and Sprint Plan

## Purpose

This document turns the Phase 0-8 roadmap into an executable sequence for one developer working with an AI coding agent. A sprint is a bounded delivery step, not a fixed calendar commitment. A sprint ends only when its acceptance criteria and the applicable Definition of Done are satisfied.

The initial product scope is authenticated Binance and Kraken spot-market research for cross-exchange arbitrage. Quant Lab is a single-operator application and does not require application login or multi-user authorization. Exchange credentials and execution controls remain security boundaries.

## Current review

### What is in place

- The repository has architecture, domain, security, testing, observability, and ADR documentation.
- The pnpm/Turborepo workspace builds API, worker, dashboard, and shared packages.
- Zod configuration, Pino logging primitives, Prisma, PostgreSQL connectivity, migrations, health endpoints, tests, and CI exist.
- PostgreSQL runs outside the repository and is configured through `DATABASE_URL`.
- Live execution defaults to disabled.

### Gaps to close before Phase 2

The current status and remediation sequence for these gaps is maintained in the [Phase 2 Readiness Plan](./phase-2-readiness-plan.md).

- The current implementation has not been committed as a stable Phase 1 baseline.
- Nest framework logs are not consistently routed through the structured logger.
- Request and job correlation IDs, metrics, and integration tests are missing.
- CI does not start PostgreSQL, apply migrations, or test database connectivity.
- API and worker create database and logger infrastructure separately instead of reusing focused shared modules.
- Shutdown and startup failures do not yet have explicit, tested behavior.
- Domain packages are placeholders and provider contracts exist only in documentation.
- Database retention, dataset lineage, and order-book reconstruction policies are not implemented.

### Planning decisions

- Spot markets only for the initial Binance/Kraken implementation.
- Authenticated endpoints are required in Phase 2 to verify credentials, balances, account capabilities, and effective fees.
- Phase 2 credentials should be read-only with trading and withdrawals disabled. Authentication testing must never place an order.
- A minimal strategy contract is introduced before arbitrage research because detection and backtesting need a stable boundary. The full plugin lifecycle remains in Phase 6.
- Market data collection starts with a configured allowlist of overlapping liquid markets rather than every listed pair.
- Raw evidence and normalized records are both retained so normalization errors can be audited.
- Live execution remains out of scope until all Phase 7 gates are complete.

## Data policy for arbitrage research

The exact retention periods must remain configuration-driven because storage volume will be measured during Phase 2. Initial defaults are:

| Data | Representation | Initial retention |
| --- | --- | --- |
| Venue, market, precision, limits, capabilities | Versioned normalized records plus source payload | Indefinite |
| Effective maker/taker fees and account tier | Versioned snapshots | Indefinite |
| Tickers and best bid/ask | Normalized events with all three timestamps | 180 days online |
| Public trades | Normalized events plus source identifiers | 180 days online |
| Candles | Normalized OHLCV with provenance | Indefinite |
| Order books | Periodic snapshots plus sequenced deltas and source metadata | 90 days online initially |
| Clock drift and ingestion latency | Time series and rollups | 180 days raw, indefinite rollups |
| Detected opportunities and evaluation inputs | Immutable research evidence | Indefinite |
| Curated experiment datasets | Immutable manifest and referenced data range | Indefinite |

Deletion must not invalidate an experiment marked reproducible. Before raw data expires, a dataset used by an experiment must be pinned, exported, or compacted into an immutable retained form.

## Global delivery rules

Every sprint must:

- start from a clean, committed baseline;
- update or add tests at the correct boundary;
- pass `pnpm check`;
- validate every migration against a disposable PostgreSQL database;
- update documentation and `.env.example` for configuration changes;
- add structured logs and relevant metrics without secrets;
- preserve `LIVE_EXECUTION_ENABLED=false` unless Phase 7 acceptance explicitly permits otherwise;
- record unresolved risks and follow-up work before closing.

## Phase 0: Repository foundation

### Sprint 0.1: Foundation closure

**Goal:** make repository governance complete and establish a stable baseline.

Tasks:

- Review all pending documentation and Phase 1 changes and commit them in intentional units.
- Add pull-request and issue templates suitable for solo development.
- Add a changelog or release-notes convention.
- Document branch, commit, migration, and ADR naming conventions.
- Add a script that validates local Markdown links.
- Mark Phase 0 completion evidence in the roadmap.

Acceptance:

- The worktree is clean after the baseline commits.
- CI passes from a fresh clone.
- A new AI session can find architecture, ADRs, Definition of Done, and this sprint plan from the documentation index.

## Phase 1: Platform skeleton

### Sprint 1.1: Runtime hardening

**Goal:** close the operational gaps in the existing skeleton.

Tasks:

- Route Nest framework logs through Pino in API and worker.
- Introduce shared database and logging modules without coupling domain packages to Nest or Prisma.
- Add request correlation IDs and a job/run correlation context.
- Add explicit startup error handling, signal handling, and graceful shutdown tests.
- Separate liveness from readiness for both API and worker.
- Add configuration tests for production, test, malformed URLs, secrets, and live-execution gates.

Acceptance:

- All application logs are structured and redact configured secrets.
- One correlation ID can be traced through an API request and representative worker operation.
- Invalid configuration and unavailable PostgreSQL produce clear non-zero startup failures.
- API and worker shut down without leaving database connections open.

### Sprint 1.2: Database integration and CI

**Goal:** prove the platform against a real disposable PostgreSQL instance on every change.

Tasks:

- Add PostgreSQL as a GitHub Actions service.
- Apply migrations in CI before integration tests.
- Test `/health/live`, `/health/ready`, Prisma connection lifecycle, and migration status.
- Add migration rollback/forward-fix guidance.
- Add baseline metrics for process health, request duration, errors, and database readiness.
- Document local PostgreSQL setup without provisioning it from this repository.

Acceptance:

- CI fails for an invalid migration or broken database query.
- API and worker integration tests use an isolated database.
- Phase 1 completion indicators in the roadmap are demonstrably satisfied.

## Phase 2: Market data foundation

### Sprint 2.1: Exact domain primitives and provider contracts

**Status:** complete on branch `agent/sprint-2-1-domain-contracts`; completion requires the supported quality gate and review evidence in the pull request.

**Goal:** create infrastructure-independent contracts before connecting exchanges.

Tasks:

- Initialize `packages/core` and `packages/market-data` as real workspace packages.
- Implement decimal-backed value objects for price, quantity, money, fee rate, and PnL.
- Implement venue, instrument, market, trading-rule, timestamp, ticker, trade, candle, and order-book types.
- Encode `eventTime`, `receivedAt`, `processedAt`, precision, source, and sequence metadata.
- Implement `MarketDataProvider`, authenticated account-read provider, and historical-data contracts.
- Add contract fixtures and compile-time dependency-boundary checks.
- Record an ADR for raw payload retention and dataset lineage if the implementation changes current assumptions.

Acceptance:

- Financial domain fields cannot be constructed from uncontrolled JavaScript `number` values.
- Binance/Kraken types cannot leak through provider outputs.
- Contract tests define required provider behavior, errors, capabilities, and timestamps.

### Sprint 2.2: Authenticated Binance and Kraken adapters

**Status:** complete on branch `agent/sprint-2-2-exchange-adapters`. Local credential-backed acceptance passed for read-only Binance and Kraken access; credentials and balance values remain outside version control and CI.

**Goal:** prove real read-only connectivity to both venues.

Tasks:

- Add CCXT behind Binance and Kraken adapters.
- Validate credentials and sandbox/live endpoint selection without logging secrets.
- Load markets, server time, balances, account capabilities, trading rules, and effective fee data.
- Implement retry, timeout, rate-limit, circuit-breaker, and typed error behavior.
- Measure clock drift and request latency.
- Add integration tests behind explicit opt-in environment flags so CI does not require personal credentials.
- Add a safe connectivity command that never places, cancels, or modifies an order.

Acceptance:

- One command verifies authenticated read access on Binance and Kraken.
- Returned balances, fee tier, precision, minimum size, and capabilities are normalized and auditable.
- Credentials with trading or withdrawal permission are rejected or produce an explicit safety warning according to provider capability.
- No Phase 2 code can call an order-placement method.

### Sprint 2.3: Market catalog and symbol normalization

**Status:** complete. The Prisma catalog, canonical aliases, versioned metadata refresh, authenticated one-shot job, and comparable-market API are implemented and covered by PostgreSQL integration fixtures.

**Goal:** identify comparable spot markets deterministically.

Tasks:

- Add Prisma models and migrations for venues, instruments, markets, aliases, trading rules, fee schedules, and capability snapshots.
- Build canonical currency and symbol mapping for Binance/Kraken spot pairs.
- Add a configured allowlist of overlapping liquid markets.
- Version metadata changes and market activation state.
- Build catalog refresh jobs and API read endpoints.
- Add fixtures for symbol differences, delistings, precision changes, and unsupported markets.

Acceptance:

- The same canonical instrument maps to both venue-specific markets where appropriate.
- Metadata refresh is idempotent and preserves history.
- The API can list comparable active markets with current constraints and fees.

### Sprint 2.4: Ticker, trade, and candle ingestion

**Status:** complete. REST backfill, native Binance/Kraken ticker WebSockets, idempotent raw and normalized persistence, bounded historical queries, drift samples, retention, ingestion metrics, reconnect/gap tests, and a concurrent 60-second live validation are implemented.

**Goal:** collect normalized time-series evidence reliably.

Tasks:

- Implement REST backfill and WebSocket ingestion for the configured market allowlist.
- Persist raw source envelopes and normalized tickers, trades, and candles.
- Add idempotency keys, batching, backpressure, reconnect, and gap detection.
- Track the three timestamp fields, source precision, drift, and ingestion latency.
- Add retention jobs and metrics for throughput, lag, duplicates, gaps, and rejected events.
- Expose historical query endpoints with bounded pagination.

Acceptance:

- Both venues can ingest concurrently for a sustained test window.
- Disconnect/reconnect tests prove duplicate handling and gap visibility.
- Stored events can be traced back to source evidence and queried by canonical market and time range.

### Sprint 2.5: Order-book reconstruction

**Status:** complete on branch `agent/sprint-2-5-order-book-reconstruction`. Normalized snapshot/delta persistence, deterministic reconstruction, invalidation rules, bounded depth queries, and regression coverage are implemented.

**Goal:** preserve the depth needed to determine executable arbitrage.

Tasks:

- Implement venue-specific snapshot and delta synchronization rules.
- Store periodic snapshots, ordered deltas, checksums or sequences where available, and invalidation reasons.
- Maintain an in-memory normalized book with configurable depth.
- Detect crossed, stale, incomplete, and sequence-gapped books.
- Add deterministic reconstruction from a snapshot plus deltas.
- Benchmark storage and processing to refine depth, snapshot interval, and 90-day retention defaults.

Acceptance:

- A persisted book can be reconstructed deterministically for a chosen instant.
- Sequence gaps invalidate the book rather than silently producing quotes.
- Depth queries return executable quantities, not only top-of-book prices.

### Sprint 2.6: Historical datasets and data quality

**Status:** complete on branch `agent/sprint-2-6-historical-datasets`. PostgreSQL historical queries, immutable manifests, stable checksums, quality reports, pin/export/compaction, retention protection, API and CLI operations are implemented.

**Goal:** make collected data usable and reproducible for research.

Tasks:

- Implement `HistoricalDataProvider` over PostgreSQL.
- Add immutable dataset manifests with venue, markets, time range, schema version, source coverage, and checksum.
- Add completeness, staleness, spread sanity, timestamp, and order-book continuity reports.
- Implement pin/export/compaction behavior before retention deletes source data.
- Add API endpoints and CLI commands to create, inspect, and validate datasets.
- Produce the first Binance/Kraken spot dataset suitable for arbitrage analysis.

Acceptance:

- A dataset has a stable identity and fails validation when source gaps exceed configured limits.
- Historical queries reproduce the same ordered records for the same manifest.
- Phase 2 completion indicators are satisfied for ticker, trade, candle, and order-book data.

## Phase 3: Arbitrage research

### Sprint 3.1: Observed opportunity detector

**Status:** complete on branch `agent/sprint-3-1-observed-opportunities`. A versioned exact-decimal detector, reproducible persistence, bidirectional evaluation, rejection telemetry, API/CLI operations, and dashboard read model are implemented.

**Goal:** detect and persist cross-venue price differences without claiming executability.

Tasks:

- Add the minimal strategy/detector contract needed to version detector configuration.
- Align fresh Binance and Kraken books by canonical instrument and event/receive time.
- Detect both buy-Binance/sell-Kraken and buy-Kraken/sell-Binance directions.
- Persist observed spread, inputs, freshness, configuration version, and rejection reasons.
- Add deterministic fixtures for positive, negative, stale, and crossed-book cases.
- Expose opportunity queries in API and dashboard.

Acceptance:

- Observed opportunities are never labeled executable.
- Every result is reproducible from persisted input references and detector configuration.
- Stale or invalid books are rejected with a measurable reason.

### Sprint 3.1.1: Continuous observation worker

**Status:** complete on branch `agent/sprint-3-1-1-continuous-observation`. The worker now runs non-overlapping read-only observation cycles with bounded backoff, status reporting, dashboard visibility, and graceful shutdown.

**Goal:** continuously collect configured spot books and evaluate observed opportunities without manual commands.

Tasks:

- Run catalog refresh, REST order-book snapshots, and observed detection from the long-lived worker.
- Prevent overlapping cycles and apply bounded exponential backoff after failures.
- Expose cycle state, last success, errors, and counts through worker status and dashboard.
- Stop active work and exchange clients cleanly during application shutdown.

Acceptance:

- Starting the worker is sufficient to keep observations current when exchange connectivity is enabled.
- A failed cycle is visible and retried without terminating the worker or creating overlapping requests.
- Manual catalog, ingestion, and detector commands remain usable for diagnostics.

### Sprint 3.2: Executable opportunity model

**Status:** complete on branch `agent/sprint-3-2-executable-opportunities`. Exact volume-weighted depth walking, effective fees, configurable slippage/latency buffers, venue rules, and configured inventory produce executable/missed/observed/rejected classifications with a persisted profit curve and maximum executable size. Delivered through `@quant-lab/strategy-engine`, the `ExecutableOpportunityService`, the `/executable-opportunities` API, the `opportunity:detect:executable` command, the continuous observation worker, and the dashboard, with unit, property-based, and PostgreSQL integration coverage.

**Goal:** estimate realizable profit for configured trade sizes.

Tasks:

- Consume order-book depth for volume-weighted buy and sell prices.
- Apply effective taker/maker fees, precision, minimum notional, lot sizes, and configurable latency/slippage buffers.
- Model inventory available on each venue and reject insufficient balances.
- Separate gross spread, fee cost, slippage, safety buffer, and expected net profit.
- Persist missed, rejected, observed, and executable classifications.
- Add property-based tests around decimal arithmetic and threshold boundaries.

Acceptance:

- The detector cannot report profit when either leg violates venue or inventory constraints.
- Profit calculation is exact, explainable, and independently testable.
- Results include the maximum executable size and profit curve across configured sizes.

### Sprint 3.3: Latency study and research dashboard

**Status:** complete on branch `agent/sprint-3-3-latency-research`. A deterministic `@quant-lab/analytics` research report quantifies false-positive rate, gross-to-net attribution, executable episode duration and latency removal, feed quality, per-symbol/direction and daily distributions, and a backtest-eligibility gate. It is reproducible from a dataset manifest and delivered through `/research/report` with CSV export, the `research:report` command, and a dashboard research panel. Covered by unit and PostgreSQL integration tests.

**Goal:** determine whether detected edges survive realistic delays.

Tasks:

- Measure feed age, cross-venue skew, decision time, and simulated submission delay.
- Track opportunity duration and disappearance rate.
- Add dashboard filters, opportunity detail, input book depth, fee breakdown, and data-quality warnings.
- Produce daily and dataset-based reports with false-positive rate and executable-opportunity distribution.
- Add export to CSV/JSON for offline analysis.
- Define thresholds that qualify a dataset or opportunity for backtesting.

Acceptance:

- Dashboard distinguishes observed and executable opportunities visually and semantically.
- A report quantifies how fees, depth, and latency remove apparent profit.
- Phase 3 metrics can be reproduced from a dataset manifest.

## Phase 4: Backtesting and simulation

### Sprint 4.1: Deterministic replay engine

**Status:** complete.

**Goal:** replay historical market evidence through the same detector contracts.

Tasks:

- Initialize simulation and analytics package boundaries.
- Implement injectable UTC simulation clock and stable event ordering.
- Replay ticker, trade, and reconstructed order-book events from dataset manifests.
- Persist experiment, run, code commit, configuration, dataset, and model versions.
- Add pause, resume, cancellation, progress, and failure state handling.
- Prove identical output hashes for repeated identical runs.

Acceptance:

- Same code, dataset, parameters, and seed produce identical results.
- Missing or ambiguous event ordering fails explicitly.
- Long runs execute in the worker without blocking the API.

### Sprint 4.2: Fill, fee, slippage, and partial-fill models

**Status:** complete.

**Goal:** replace optimistic opportunity assumptions with explicit execution simulation.

Tasks:

- Implement configurable market-order and limit-order fill models.
- Consume historical book depth and model partial fills, book depletion, latency, and cancellation.
- Version fee, slippage, latency, and inventory-rebalancing assumptions.
- Add adverse and conservative scenarios rather than a single estimate.
- Add regression fixtures for gaps, thin books, precision, and disappearing liquidity.

Acceptance:

- No fill occurs merely because an observed price existed.
- Fill decisions include evidence and model version.
- Scenario results expose sensitivity to latency, fees, and requested size.

### Sprint 4.3: Backtest analytics and comparison

**Status:** complete.

**Goal:** decide whether the arbitrage hypothesis survives historical testing.

Tasks:

- Calculate net PnL, drawdown, hit rate, fill rate, capital utilization, inventory imbalance, and false positives.
- Add experiment comparison, parameter sweeps, and result exports.
- Build dashboard pages for run state, assumptions, metrics, and evidence.
- Add data leakage and look-ahead checks.
- Define the quantitative gate required to proceed to paper trading.

Acceptance:

- Results show gross-to-net attribution and capital requirements.
- Runs can be compared without losing parameter or dataset provenance.
- Paper-trading eligibility is a documented validation decision, not a runtime dependency.

## Phase 5: Paper trading

### Sprint 5.1: Accounting and simulated execution

**Goal:** maintain exact paper balances, orders, fills, and positions.

Tasks:

- Initialize `packages/paper-trading` and reusable execution contracts.
- Implement order state machine, fills, reservations, balances, fees, and double-entry-style ledger entries.
- Use live or replayed books through a simulated execution adapter.
- Add reconciliation invariants and property-based accounting tests.
- Persist every transition with correlation and strategy version.

Acceptance:

- Balances reconcile after full, partial, rejected, canceled, and failed orders.
- Total filled quantity never exceeds order quantity.
- Paper and future live order contracts remain compatible without sharing infrastructure details.

### Sprint 5.2: Inventory arbitrage workflow and risk limits

**Goal:** run the strategy against live feeds without sending venue orders.

Tasks:

- Maintain independent simulated inventories for Binance and Kraken.
- Simulate both arbitrage legs, latency, partial-fill asymmetry, and rebalancing needs.
- Implement maximum order, exposure, daily loss, stale-feed, and inventory-imbalance rules.
- Add start, pause, stop, and emergency-stop operator controls for the single local operator.
- Add alerts and a dashboard for lifecycle, balances, risk blocks, and reconciliation.

Acceptance:

- Risk rules block simulated orders with an explicit reason.
- Restart recovery reconstructs state without duplicate fills.
- Paper performance can be compared with the detector's expected profit.

### Sprint 5.3: Paper-trading validation campaign

**Goal:** gather enough live evidence to decide whether live execution is justified.

Tasks:

- Run a defined multi-day paper campaign across selected spot pairs.
- Record uptime, feed gaps, predicted versus simulated profit, slippage, missed legs, and inventory drift.
- Tune thresholds only through versioned experiment configuration.
- Produce a go/no-go report and unresolved-risk register.
- Test incident procedures, emergency stop, and recovery.

Acceptance:

- Campaign duration and minimum sample count are defined before evaluation.
- Results are reproducible and include losing periods, not only favorable examples.
- Phase 5 closes with a documented go/no-go decision; no automatic promotion occurs.

## Phase 6: Strategy engine

### Sprint 6.1: Versioned strategy plugin lifecycle

**Goal:** generalize the minimal detector contract without rewriting arbitrage logic.

Tasks:

- Implement plugin discovery, metadata, Zod configuration, lifecycle, capability requirements, and semantic versioning.
- Store immutable strategy versions and commit SHA.
- Isolate strategy logic from CCXT, Prisma, Nest, and transport concerns.
- Add contract tests and example no-op/reference strategies.
- Migrate the arbitrage detector into a versioned plugin.

Acceptance:

- A strategy can be loaded, validated, executed, and versioned independently.
- Invalid capability or market requirements fail before a run starts.
- Existing experiment and paper results retain their original strategy identity.

### Sprint 6.2: Portfolio rules and experiment orchestration

**Goal:** coordinate strategies, experiments, and portfolio constraints consistently.

Tasks:

- Implement strategy run scheduling and lifecycle state transitions.
- Add portfolio-level capital allocation and signal constraints.
- Add parameter-set management, experiment lineage, cancellation, and retry semantics.
- Expose operator controls and read models in API/dashboard.
- Add audit logs and metrics for every lifecycle transition.

Acceptance:

- Portfolio rules can reduce or reject strategy intent before execution.
- Every run is attributable to strategy version, parameters, dataset/feed, and source commit.
- Phase 6 completion indicators are satisfied without introducing live execution.

## Phase 7: Controlled live execution

### Sprint 7.1: Execution safety boundary

**Goal:** build live-capable adapters that remain impossible to enable accidentally.

Tasks:

- Initialize `packages/execution` and implement Binance/Kraken execution adapters behind `ExecutionProvider`.
- Require `LIVE_EXECUTION_ENABLED`, an explicit runtime approval token, venue allowlist, market allowlist, and configured limits.
- Validate balances, rules, order intent, stale data, and risk gates immediately before submission.
- Implement idempotent client order IDs, timeouts, uncertain-result handling, and a persistent kill switch.
- Add sandbox/venue test-environment contract tests where available.

Acceptance:

- Unit, integration, and startup tests prove live submission is impossible by default.
- Unknown order outcomes are reconciled before retry.
- Withdrawal operations do not exist in application capabilities.

### Sprint 7.2: Audit, reconciliation, and operator approval

**Goal:** make every live action observable and recoverable for the single operator.

Tasks:

- Persist append-only order intent, approval, submission, acknowledgement, fill, cancellation, and reconciliation events.
- Reconcile venue orders, fills, balances, and local ledger continuously.
- Add local operator confirmation for the first live run and after kill-switch activation.
- Add alerts for divergence, partial-leg exposure, stale feeds, repeated rejects, and loss limits.
- Write and test incident, rollback, credential rotation, and recovery runbooks.

Acceptance:

- Every venue-side order maps to an approved local intent and audit trail.
- Reconciliation detects injected mismatches.
- Kill switch blocks new orders and has defined behavior for open orders.

### Sprint 7.3: Minimal-capital controlled pilot

**Goal:** validate execution assumptions with deliberately limited real exposure.

Tasks:

- Define maximum pilot capital, markets, order count, duration, and stop conditions before enabling execution.
- Start with the smallest valid venue order sizes and manual supervision.
- Compare predicted, paper, and realized outcomes for every opportunity.
- Review fees, latency, partial legs, inventory drift, and reconciliation daily.
- Disable execution after the pilot and produce a go/no-go report before any expansion.

Acceptance:

- Pilot limits cannot be changed without a new explicit approval record.
- Realized results reconcile exactly to venue data.
- Continued live operation requires a documented decision based on pilot evidence.

## Phase 8: Market and broker expansion

### Sprint 8.1: Third crypto venue

**Goal:** prove that provider and strategy boundaries support another spot exchange.

Tasks:

- Select Coinbase, OKX, or Bybit using liquidity, jurisdiction, API quality, fees, and account availability.
- Implement market data, authenticated read, normalization, and contract tests.
- Extend arbitrage comparison from two venues to N venues.
- Measure new data volume and opportunity quality.
- Record adapter gaps instead of weakening common contracts.

Acceptance:

- The new venue requires no Binance/Kraken-specific changes in strategy logic.
- N-venue opportunities preserve venue-specific fees, constraints, and timestamps.

### Sprint 8.2: Remaining prioritized crypto venues

**Goal:** add additional crypto venues only when research evidence supports the cost.

Tasks:

- Rank remaining Coinbase/OKX/Bybit integrations from Sprint 8.1 evidence.
- Add one venue per bounded delivery iteration using the established contract suite.
- Extend inventory allocation, monitoring, retention, and operational limits.
- Stop expansion when marginal opportunity quality does not justify complexity.

Acceptance:

- Each venue independently passes provider, data-quality, and safety contracts.
- Expansion decisions cite measured opportunity and operational evidence.

### Sprint 8.3: IBKR and session-based market model

**Goal:** validate the multi-market architecture with a broker and non-crypto instruments.

Tasks:

- Add market calendars, sessions, contract identifiers, corporate-action awareness, and broker account semantics.
- Implement IBKR authenticated read and market-data adapter before execution.
- Validate equities and ETFs first; defer forex, futures, and options to separate follow-up sprints.
- Test currency conversion, contract multipliers, market closures, and timestamp behavior.
- Record ADRs for every semantic difference that cannot fit existing contracts safely.

Acceptance:

- Crypto-specific assumptions do not leak into broker-neutral domain entities.
- Session-based instruments can be normalized without pretending they trade continuously.
- IBKR execution remains disabled until a separate safety review equivalent to Phase 7.

### Sprint 8.4+: Additional asset classes

Forex, futures, and options are separate future sprints. Each requires its own domain review, data model, risk model, backtesting validation, paper campaign, and controlled-execution gate. They must not be grouped into a single implementation sprint.

## Recommended immediate sequence

Execute next:

1. Sprint 0.1: Foundation closure.
2. Sprint 1.1: Runtime hardening.
3. Sprint 1.2: Database integration and CI.
4. Sprint 2.1: Exact domain primitives and provider contracts.

Do not purchase, transfer, or allocate exchange capital for execution during these sprints. Phase 2 authenticated connectivity needs read-only API keys only.

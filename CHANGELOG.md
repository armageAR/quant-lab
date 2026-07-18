# Changelog

- Completed Phase 4 with deterministic historical replay, realistic execution models, persisted backtest runs, analytics, comparisons, exports, dashboard visibility, and a quantitative paper-trading gate.

All notable changes are recorded here. Quant Lab follows a lightweight Keep a Changelog structure while the project is pre-release.

## Unreleased

### Added

- Sprint 4.4 backtest operations workspace: bounded dataset discovery and
  preparation, experiment creation, exact-decimal run configuration,
  three-scenario sweeps, immutable request review, visibility-aware queue
  polling, lifecycle controls, comparison, evidence inspection, and CSV export
  through a same-origin dashboard BFF.

- Latency study and research report (Sprint 3.3): a deterministic `@quant-lab/analytics` report over persisted executable evaluations that quantifies the false-positive rate, gross-to-net attribution (fee and slippage shares), executable-opportunity episodes and how many vanish faster than a simulated submission delay, feed-age and skew quality, per-symbol/direction and daily distributions, and a backtest-eligibility gate. Reproducible from a dataset manifest, exposed through `/research/report` (+ CSV export), the `research:report` command, and a dashboard research panel with data-quality warnings.
- Executable opportunity model (Sprint 3.2): exact volume-weighted fills over order-book depth, effective taker fees, configurable slippage/latency buffers, venue rules (minimum quantity, notional, lot size) and configured per-venue inventory. Classifies each direction as executable, missed, observed, or rejected; persists the profit curve and maximum executable size without ever reporting profit when a leg breaches a constraint. Exposed through `/executable-opportunities`, the `opportunity:detect:executable` command, the continuous observation worker, and the research dashboard.
- Exact decimal domain values and precision-safe quantization in `@quant-lab/core`.
- UTC source timestamps preserving millisecond or microsecond precision and three-stage event timing.
- Normalized market events, reusable fixtures, typed provider errors, and public/authenticated/historical read contracts in `@quant-lab/market-data`.
- Read-only Binance/Kraken CCXT adapters with permission inspection, exact normalization, resilience, clock-drift measurement, and opt-in connectivity tests.

- Phase 1 platform skeleton and readiness hardening.
- Structured Nest/Pino logging, correlation context, Prometheus metrics, and worker operational health.
- Shared database lifecycle and PostgreSQL-backed CI/integration tests.

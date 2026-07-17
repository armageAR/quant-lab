# Changelog

All notable changes are recorded here. Quant Lab follows a lightweight Keep a Changelog structure while the project is pre-release.

## Unreleased

### Added

- Exact decimal domain values and precision-safe quantization in `@quant-lab/core`.
- UTC source timestamps preserving millisecond or microsecond precision and three-stage event timing.
- Normalized market events, reusable fixtures, typed provider errors, and public/authenticated/historical read contracts in `@quant-lab/market-data`.
- Read-only Binance/Kraken CCXT adapters with permission inspection, exact normalization, resilience, clock-drift measurement, and opt-in connectivity tests.

- Phase 1 platform skeleton and readiness hardening.
- Structured Nest/Pino logging, correlation context, Prometheus metrics, and worker operational health.
- Shared database lifecycle and PostgreSQL-backed CI/integration tests.

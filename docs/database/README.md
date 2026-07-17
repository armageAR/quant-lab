# Database Notes

PostgreSQL and Prisma are the persistence layer for Quant Lab. The database should store normalized platform data and operational state, but it should not contain strategy logic.

## Expected persisted categories

- market data;
- normalized instruments and venues;
- opportunities and research observations;
- experiments and backtest runs;
- paper-trading state;
- execution audit records;
- configuration and reference data.

## Schema evolution

- Prisma migrations should be incremental and reviewable;
- schema changes should preserve historical data where practical;
- breaking changes should be documented as decisions;
- time-series volume growth should be considered from the beginning.

## Time-series and retention concerns

Market data and event logs can grow quickly. The design should account for:

- retention policies;
- partitioning or archiving if needed later;
- downsampling or rollups for analysis;
- storage of both raw and normalized records when required for research reproducibility.

## Operational rules

- keep the schema aligned with the domain model and provider contracts;
- do not encode venue-specific quirks into every table if a normalized model can hold them;
- avoid treating Prisma models as the business model by default.

## Market catalog schema

Sprint 2.3 adds normalized `Venue`, `Instrument`, and `Market` records. `MarketAlias` preserves venue-symbol history, while `TradingRuleVersion`, `FeeScheduleVersion`, and `CapabilitySnapshot` use content fingerprints so repeated refreshes are idempotent and metadata changes remain auditable.

Missing allowlisted markets are marked inactive; their aliases and version history are not deleted. Prices, quantities, notionals, and fees use `Decimal(38,18)` in PostgreSQL and are exposed as decimal strings.

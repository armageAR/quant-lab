# Testing

## Expectations

Quant Lab should favor deterministic, reproducible tests over brittle integration tests where possible. Test coverage should reflect the risk of the subsystem being changed.

## Unit tests

- strategy logic;
- normalization helpers;
- fee and slippage models;
- risk-rule evaluation;
- configuration parsing;
- domain calculations.

## Integration tests

- API and worker interactions;
- database persistence;
- Prisma repositories;
- experiment storage;
- job orchestration.

## Provider contract tests

- `MarketDataProvider` behavior;
- `ExecutionProvider` behavior;
- `HistoricalDataProvider` behavior;
- venue-specific normalization and capability reporting.

## Deterministic strategy tests

- fixed inputs should produce fixed outputs;
- signal generation should be repeatable;
- strategy versions should be testable against frozen fixtures.

## Backtest reproducibility tests

- same dataset plus same parameters should produce the same result;
- code version or commit SHA should be recorded;
- timestamps and fill assumptions should remain stable.

## Database integration tests

- schema changes;
- repository reads and writes;
- migration behavior;
- retention-related logic where present.

## Exchange sandbox tests

- use sandbox or test environments where available;
- validate order placement and cancellation flows;
- verify symbol normalization and precision handling;
- avoid assuming sandbox behavior matches production perfectly.

## End-to-end tests

- dashboard to API flows;
- API to worker orchestration;
- paper-trading lifecycle;
- alert or audit visibility for critical flows.

## Fixtures and time control

- use fixed fixtures for market data and venue metadata;
- mock or freeze time for simulation and backtesting;
- preserve dataset snapshots for regression tests.

## Failure injection

- stale feeds;
- disconnects;
- rejected orders;
- partial fills;
- database failures;
- queue failures;
- malformed payloads.

## Network reconnect tests

- reconnect after disconnect;
- resume or backfill stale feeds where required;
- detect sequence gaps and invalid snapshots.

## Risk-rule tests

- maximum position size;
- maximum loss;
- exposure limits;
- kill-switch behavior;
- live execution gating.

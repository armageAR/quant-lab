# Architecture

Quant Lab is organized as a Turborepo monorepo with a small set of focused applications and shared packages.

## Applications

- `apps/api`: NestJS API for orchestration, reads, and operational endpoints
- `apps/worker`: ingestion, scheduled jobs, strategy runs, and execution workflows
- `apps/dashboard`: Next.js UI for monitoring, configuration, and review

## Packages

- `packages/core`: domain entities, value objects, enums, and core interfaces
- `packages/market-data`: market data provider abstractions and CCXT-based implementations
- `packages/strategy-engine`: strategy lifecycle, signal evaluation, and portfolio rules
- `packages/paper-trading`: simulated fills, account state, and execution replay
- `packages/analytics`: metrics, reports, and performance calculations
- `packages/execution`: execution adapters and order routing contracts
- `packages/shared`: generic utilities, types, and reusable helpers

## Key boundaries

- Strategy code should depend on abstractions, not exchange-specific details.
- Market data access should flow through `MarketDataProvider` contracts.
- Paper trading and live execution should share the same order and fill semantics where possible.
- Persistence should be handled through Prisma and PostgreSQL, with domain logic kept out of the database layer.

## Exchange integration model

CCXT is the first integration layer for Binance and Kraken. Future broker support, including IBKR, should fit behind the same provider-oriented design.


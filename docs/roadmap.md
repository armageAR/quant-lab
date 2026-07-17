# Roadmap

## Phase 0: Repository foundation

- Define repo structure and documentation
- Establish shared conventions for packages and apps
- Capture architecture and core domain language

## Phase 1: Platform skeleton

- Bootstrap pnpm and Turborepo workspace
- Add NestJS API and worker projects
- Add Next.js dashboard
- Wire PostgreSQL and Prisma

## Phase 2: Data and research core

- Implement market data ingestion abstractions
- Add Binance and Kraken connectors through CCXT
- Introduce core strategy interfaces
- Build analytics and reporting primitives

## Phase 3: Paper trading

- Simulate fills, balances, and position lifecycle
- Run strategies against historical and live paper feeds
- Persist paper trading state and results

## Phase 4: Controlled execution

- Add guarded live execution paths
- Add risk checks and operational controls
- Prepare for broader venue support

## Phase 5: Broker expansion

- Add IBKR integration
- Generalize exchange and broker configuration
- Expand monitoring and operational tooling


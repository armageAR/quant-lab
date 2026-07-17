# AI Context

This repository is intended to be developed with agent assistance. The following context should remain stable and visible:

- The system is a modular crypto trading platform.
- TypeScript is the primary implementation language.
- NestJS is used for backend orchestration.
- Next.js is used for the dashboard.
- PostgreSQL and Prisma are the persistence layer.
- pnpm and Turborepo manage the workspace.
- CCXT is the initial exchange integration layer.
- Binance and Kraken are the first supported venues.
- Paper trading comes before live execution.
- A modular `MarketDataProvider` architecture is required.
- IBKR support is a future expansion target.

When implementing features, keep exchange adapters, strategy logic, and persistence boundaries separate.


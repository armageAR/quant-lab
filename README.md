# Quant Lab

Quant Lab is a modular crypto trading platform built with Node.js, TypeScript, NestJS, Next.js, PostgreSQL, Prisma, pnpm, and Turborepo.

## Scope

- `apps/api`: NestJS backend API
- `apps/worker`: background jobs, ingestion, and strategy execution
- `apps/dashboard`: Next.js dashboard
- `packages/core`: shared domain models and primitives
- `packages/market-data`: exchange and market data abstractions
- `packages/strategy-engine`: strategy evaluation and signal generation
- `packages/paper-trading`: simulated order execution and portfolio tracking
- `packages/analytics`: performance, metrics, and reporting
- `packages/execution`: live and paper execution adapters
- `packages/shared`: common utilities and cross-cutting helpers

## Initial direction

- Start with paper trading before any live execution path.
- Use a modular `MarketDataProvider` architecture so exchanges can be added without rewiring the system.
- Support Binance and Kraken first through CCXT.
- Keep the design ready for future IBKR integration.

## Documentation

- [Vision](docs/vision.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Tech Stack](docs/tech-stack.md)
- [Project Principles](docs/project-principles.md)
- [Glossary](docs/glossary.md)
- [AI Context](docs/ai-context.md)


# Quant Lab

Quant Lab is a multi-market quantitative research and trading experimentation platform.

Crypto is the first implementation market, but the architecture is intended to extend to equities, ETFs, forex, futures, options, and other broker-supported instruments.

## Research lifecycle

Quant Lab is designed around a research-first workflow:

1. Market data collection
2. Data normalization
3. Opportunity detection
4. Strategy simulation
5. Backtesting
6. Performance analysis
7. Risk validation
8. Paper trading
9. Controlled live execution

Live execution is not the default next step after defining a strategy. Backtesting, paper trading, and explicit risk review come first.

## Monorepo structure

- `apps/api`: NestJS orchestration API
- `apps/worker`: ingestion, simulation, backtests, and job processing
- `apps/dashboard`: Next.js operator and research UI
- `packages/core`: domain primitives and shared types
- `packages/market-data`: market data abstractions and adapters
- `packages/strategy-engine`: strategy lifecycle and signal generation
- `packages/paper-trading`: simulated execution and portfolio state
- `packages/analytics`: performance, risk, and reporting logic
- `packages/execution`: execution contracts and adapters
- `packages/shared`: common utilities and helpers
- `prisma`: PostgreSQL schema and migrations
- `scripts`: maintenance and support scripts
- `.github/workflows`: CI workflows

## Initial venues

- Binance
- Kraken

CCXT is the initial integration layer. Future venue support includes Coinbase, OKX, Bybit, and Interactive Brokers.

## Current status

- Phase 1 platform skeleton is implemented.
- API, worker, and dashboard applications are initialized.
- PostgreSQL, Prisma migrations, shared configuration, structured logging, linting, and testing are configured.
- No market data connectors, strategies, backtests, or execution flows are implemented yet.

## Local development

Requirements: Node.js 20.19 or newer, Corepack, and an accessible PostgreSQL instance.

```bash
cp .env.example .env
corepack pnpm install
corepack pnpm db:deploy
corepack pnpm dev
```

Set `DATABASE_URL` in `.env` to the local or remote PostgreSQL database before deploying migrations. Quant Lab does not provision or manage the database process.

The API listens on `http://localhost:3000`, including `/health/live`, `/health/ready`, and `/metrics`. The dashboard listens on `http://localhost:3001`. Worker health and metrics listen on `http://localhost:3002` by default. Run the PostgreSQL-independent quality pipeline with `corepack pnpm check`, or the complete database-backed gate with `corepack pnpm check:ci` against a dedicated test database.

## Documentation

### Product

- [Vision](docs/vision.md)
- [Roadmap](docs/roadmap.md)
- [Sprint Plan](docs/sprint-plan.md)
- [Phase 2 Readiness Plan](docs/phase-2-readiness-plan.md)
- [Phase 1 Completion](docs/phase-1-completion.md)
- [Project Principles](docs/project-principles.md)
- [Definition of Done](docs/definition-of-done.md)
- [Development Workflow](docs/development.md)

### Architecture

- [Architecture](docs/architecture.md)
- [Tech Stack](docs/tech-stack.md)
- [Providers](docs/providers.md)
- [Domain Model](docs/domain-model.md)

### Domain and research

- [Glossary](docs/glossary.md)
- [Strategies](docs/strategies/README.md)
- [Experiments](docs/experiments/README.md)

### Exchanges and data

- [Exchange Notes](docs/exchanges/README.md)
- [Binance](docs/exchanges/binance.md)
- [Kraken](docs/exchanges/kraken.md)
- [IBKR](docs/exchanges/ibkr.md)
- [API Notes](docs/api/README.md)
- [Database Notes](docs/database/README.md)

### Operations and governance

- [Security](docs/security.md)
- [Observability](docs/observability.md)
- [Testing](docs/testing.md)
- [Configuration](docs/configuration.md)
- [Decisions](docs/decisions/README.md)
- [Meetings](docs/meetings/README.md)

### AI context

- [AI Context](docs/ai-context.md)

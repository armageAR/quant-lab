# Quant Lab

Quant Lab is a personal laboratory for quantitative trading research and software engineering. It is built to explore cross-exchange crypto opportunities, reproducible simulations, and AI-assisted development practices—not to advertise a profitable trading system or an autonomous trading bot.

The first research case compares Binance and Kraken spot markets. The architecture is designed to accommodate other venues and asset classes later.

## What is implemented

- A TypeScript monorepo with a NestJS API, a worker, a Next.js/React research dashboard, and focused domain packages.
- Read-only exchange adapters using CCXT, with normalized market catalogs and configurable overlapping spot markets.
- REST backfill and Binance/Kraken WebSocket ingestion, with raw and normalized records, timestamps, duplicate and gap handling, retention, and historical queries.
- Cross-exchange opportunity research that separates observed spreads from estimates adjusted for fees, order-book depth, venue rules, inventory, slippage, and latency.
- Persisted research runs, reporting, deterministic historical replay, versioned simulation assumptions, backtest comparison, and analytics.
- PostgreSQL and Prisma persistence, structured logging, health and metrics endpoints, automated tests, and PostgreSQL-backed CI.

These are research and engineering capabilities. The repository does not claim profitable strategies or production trading results. Paper trading, a full strategy plugin lifecycle, and controlled live execution are separate roadmap stages; live execution is disabled by default. See the [roadmap](docs/roadmap.md) for stage-by-stage scope.

## Engineering focus

Quant Lab is also a coding experiment: one developer working incrementally with an AI coding agent. Architecture decisions, small reviewable changes, deterministic tests, integration checks, and documented acceptance criteria are part of the workflow. AI-generated work is subject to the same review and quality gates as other changes. The [sprint plan](docs/sprint-plan.md), [development workflow](docs/development.md), and [AI context](docs/ai-context.md) document those practices.

## Technology

| Area | Tools |
| --- | --- |
| API and worker | Node.js, TypeScript, NestJS, Zod, Pino |
| Dashboard | Next.js, React |
| Data and persistence | PostgreSQL, Prisma |
| Market connectivity | CCXT, REST, WebSockets; Binance and Kraken first |
| Workspace and quality | pnpm, Turborepo, Vitest, ESLint, GitHub Actions |

The [tech stack](docs/tech-stack.md) distinguishes implemented dependencies from planned technology. Redis, BullMQ, additional exchanges, and broader asset classes are future work.

## Repository layout

- `apps/api`: research and orchestration API.
- `apps/worker`: ingestion, observation, research, and simulation jobs.
- `apps/dashboard`: operator and research interface.
- `packages/core`, `packages/market-data`, `packages/exchange-adapters`: domain values, provider contracts, and venue connectivity.
- `packages/market-catalog`, `packages/market-ingestion`: normalized instruments and traceable market data.
- `packages/strategy-engine`, `packages/simulation`, `packages/analytics`: opportunity research, backtesting, and reports.
- `packages/paper-trading`, `packages/execution`: evolving simulation and execution boundaries; their presence does not imply live trading is available.
- `packages/database`, `prisma`: database lifecycle, schema, and migrations.
- `docs`, `scripts`, `.github/workflows`: design notes, maintenance tools, and CI.

## Run locally

Requirements: Node.js 20.19 or newer, Corepack, and a separate PostgreSQL instance.

```bash
cp .env.example .env
# Set DATABASE_URL in .env for your local PostgreSQL instance.
corepack pnpm install
corepack pnpm db:deploy
corepack pnpm dev
```

The API defaults to `http://localhost:3000` (`/health/live`, `/health/ready`, and `/metrics`). The dashboard defaults to `http://localhost:3001`; worker health and metrics use port `3002`. Local startup does not by itself collect market data: venue settings, credentials for authenticated read-only checks, and ingestion commands are documented in the [configuration](docs/configuration.md) and [testing](docs/testing.md) notes. Do not commit `.env` or exchange credentials.

Run the PostgreSQL-independent checks with `corepack pnpm check`. Run `corepack pnpm check:ci` only with a dedicated disposable test database configured in `DATABASE_URL`; it deploys migrations and runs integration and process tests.

## Documentation

- [Vision and scope](docs/vision.md)
- [Roadmap and implementation status](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [Tech stack](docs/tech-stack.md)
- [Sprint plan](docs/sprint-plan.md)
- [Security](docs/security.md)
- [Testing](docs/testing.md)
- [Development workflow](docs/development.md)
- [AI context](docs/ai-context.md)

This project is for experimentation and research. Its analysis and simulations are not financial advice.

# Tech Stack

This page distinguishes dependencies used by the repository from planned integrations. A package's presence does not mean that every stage of the research lifecycle is complete.

## Implemented stack

| Area | Technology | Use |
| --- | --- | --- |
| API and worker | Node.js, TypeScript, NestJS | HTTP orchestration and background research jobs |
| Configuration and logs | Zod, Pino | Validated settings, structured logs, and redaction |
| Dashboard | Next.js, React | Research and operator views |
| Persistence | PostgreSQL, Prisma | Market records, research evidence, and migrations |
| Market connectivity | CCXT, WebSockets, REST | Read-only Binance/Kraken adapters, streaming, and backfill |
| Quantitative calculations | decimal.js | Explicit financial precision in research and simulation |
| Workspace | pnpm, Turborepo | Monorepo builds and package boundaries |
| Quality | Vitest, ESLint, Prettier, GitHub Actions | Unit and integration checks, builds, and CI |

The [roadmap](roadmap.md) describes which product capabilities are complete. The first market is crypto spot; Binance and Kraken are the initial venues. Live order execution is not an implemented product capability.

## Planned or later-stage work

- Redis and BullMQ for durable queue orchestration.
- Additional exchanges such as Coinbase, OKX, and Bybit.
- Interactive Brokers and non-crypto asset classes.
- Controlled live execution after paper trading and risk validation.

Some older design documents describe target architecture. Check the roadmap and current code before describing a planned component as implemented.

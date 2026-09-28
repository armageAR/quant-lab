# AI Context

Use this file as stable context before making changes. Check the [roadmap](roadmap.md) and code for current implementation status; design documents include future capabilities. Do not claim unfinished work exists, and inspect the repository before introducing duplicate abstractions.

## Stable facts

- Quant Lab is multi-market and crypto-first.
- Implemented dependencies include Node.js, TypeScript, NestJS, Next.js, React, PostgreSQL, Prisma, pnpm, Turborepo, Zod, Pino, CCXT, WebSockets, decimal.js, and Vitest. Verify package manifests before adding a technology to public-facing descriptions.
- Binance and Kraken are the initial venues.
- Interactive Brokers is a future support target.
- Redis and BullMQ are planned infrastructure, not current requirements.
- Market ingestion, cross-exchange opportunity research, and deterministic backtesting are described as implemented in the roadmap. Paper trading, a full strategy plugin lifecycle, and controlled live execution remain distinct roadmap stages.
- The monorepo boundary is `apps/`, `packages/`, `prisma/`, `docker/`, `docs/`, `scripts/`, and `.github/workflows/`.

## Research lifecycle

The intended workflow is:

1. Market data collection
2. Data normalization
3. Opportunity detection
4. Strategy simulation
5. Backtesting
6. Performance analysis
7. Risk validation
8. Paper trading
9. Controlled live execution

Live execution is never the default next step after a strategy is written.

## Research focus

- The first major research use case is cross-exchange crypto arbitrage between Binance and Kraken.
- Treat observed profit and executable profit as different values.
- Include fees, slippage, depth, latency, precision, symbol normalization, and transfer constraints in analysis.

## Architecture rules

- Keep strategies isolated from CCXT, Binance, Kraken, Prisma, NestJS, HTTP, WebSockets, and database internals.
- Keep exchange-specific behavior behind adapters.
- Keep paper execution and live execution semantically compatible where practical.
- Use explicit provider contracts for market data, historical data, and execution.
- Add new abstractions only after inspecting the existing repository and confirming they are needed.

## Safety rules

- Backtesting comes before paper trading.
- Paper trading comes before live execution.
- Live execution is disabled by default.
- Do not expose exchange credentials to the frontend.
- Treat risk controls, reconciliation, audit logs, and kill-switch behavior as first-class requirements.

## AI-assisted development

- The sprint plan is structured for one developer working with an AI coding agent. Treat generated code as a proposal: inspect it, review architecture boundaries, run the relevant quality gate, and document acceptance evidence.
- Do not claim a specific AI coding product was used unless the project history supports that claim.

## Documentation and testing

- Update documentation when architecture decisions change.
- Record important architectural decisions in ADRs.
- Prefer incremental implementation over broad rewrites.
- Use deterministic tests and fixtures where possible.
- Test time-dependent code with controlled clocks or frozen time.

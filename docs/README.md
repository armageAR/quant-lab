# Documentation

This directory contains the working design and governance documents for Quant Lab.
The documentation is intentionally written in English so it can serve as stable shared context for implementation work.

## Product

- [Vision](./vision.md): problem statement, goals, users, and product direction
- [Roadmap](./roadmap.md): delivery phases and acceptance criteria
- [Sprint Plan](./sprint-plan.md): executable solo-development plan and project review
- [Backtest Operations UI Plan](./backtest-operations-ui-plan.md): Sprint 4.4 web workflow tasks and acceptance criteria
- [Paper Trading](./paper-trading.md): Phase 5 accounting, risk, lifecycle, validation campaign, and incident procedure
- [Phase 2 Readiness Plan](./phase-2-readiness-plan.md): audited Phase 1 gaps and remediation tasks
- [Phase 1 Completion](./phase-1-completion.md): quality-gate and completion evidence
- [Project Principles](./project-principles.md): architecture, research, and execution guardrails
- [Definition of Done](./definition-of-done.md): completion criteria for product and engineering work
- [Development Workflow](./development.md): branches, commits, migrations, and quality commands

## Architecture

- [Architecture](./architecture.md): system boundaries, flows, and runtime responsibilities
- [Tech Stack](./tech-stack.md): current and planned technical stack
- [Providers](./providers.md): conceptual provider interfaces
- [Domain Model](./domain-model.md): core entities and relationships

## Domain

- [Glossary](./glossary.md): canonical terminology
- [Strategies](./strategies/README.md): strategy documentation entry point
- [Experiments](./experiments/README.md): experiment tracking entry point

## Research

- [Strategy template](./strategies/strategy-template.md)
- [Cross-exchange arbitrage](./strategies/cross-exchange-arbitrage.md)
- [Experiment template](./experiments/experiment-template.md)

## Exchanges and providers

- [Exchange notes](./exchanges/README.md)
- [Binance](./exchanges/binance.md)
- [Kraken](./exchanges/kraken.md)
- [IBKR](./exchanges/ibkr.md)

## Data and API

- [API notes](./api/README.md)
- [Database notes](./database/README.md)
- [Order-book reconstruction](./order-books.md)
- [Historical datasets](./historical-datasets.md)
- [Research report and latency study](./research-report.md)
- [Backtesting and simulation](./backtesting.md)

## Operations

- [Configuration](./configuration.md)
- [Security](./security.md)
- [Observability](./observability.md)
- [Testing](./testing.md)

## Governance

- [Decisions](./decisions/README.md)
- [ADR template](./decisions/ADR-000-template.md)
- [ADR 001: Modular monorepo](./decisions/ADR-001-modular-monorepo.md)
- [ADR 002: Crypto-first, multi-market domain](./decisions/ADR-002-crypto-first-multi-market.md)
- [ADR 003: Decimal and numeric precision](./decisions/ADR-003-decimal-numeric-precision.md)
- [ADR 004: Time and clock model](./decisions/ADR-004-time-and-clock-model.md)
- [Meetings](./meetings/README.md)
- [Meeting template](./meetings/meeting-template.md)

## AI context

- [AI Context](./ai-context.md): stable instructions for coding agents

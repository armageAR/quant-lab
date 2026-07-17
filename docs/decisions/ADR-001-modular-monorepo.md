# ADR-001: Modular TypeScript Monorepo

## Status

Accepted

## Date

2026-07-17

## Context

Quant Lab needs to coordinate research, simulation, execution, and user-facing workflows without coupling those concerns together. The platform also needs to share types, contracts, and utilities across API, worker, dashboard, and domain packages.

A single application monolith would make it harder to separate responsibilities, evolve market adapters independently, and preserve clean provider boundaries.

## Decision

Use a TypeScript Turborepo monorepo with separate applications and shared packages:

- `apps/api`
- `apps/worker`
- `apps/dashboard`
- `packages/core`
- `packages/market-data`
- `packages/strategy-engine`
- `packages/paper-trading`
- `packages/analytics`
- `packages/execution`
- `packages/shared`

## Alternatives considered

- A single app with internal modules.
- Multiple independent repositories.
- A backend-only repository with a separate dashboard repository.

## Consequences

- Shared contracts can be reused consistently.
- Dependency boundaries can be enforced at the package level.
- Strategy, execution, and data concerns can evolve separately.
- Build and test tooling can be centralized.

## Risks

- Monorepo complexity if boundaries are ignored.
- Build orchestration overhead if packages are too granular.
- Cross-package coupling if contracts are not kept stable.

## Follow-up work

- Define workspace tooling and conventions.
- Document package ownership and dependency direction.
- Add ADRs for provider contracts, persistence, and execution safety as implementation progresses.

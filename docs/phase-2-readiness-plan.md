# Phase 2 Readiness Plan

## Purpose

This plan audits the gaps listed in the sprint plan and defines the work required to close Phase 1 safely before market-data implementation expands the system. It is optimized for one developer working sequentially with an AI coding agent.

## Audit result

| Gap | Status | Evidence | Phase 2 impact |
| --- | --- | --- | --- |
| Phase 1 implementation is not committed as a stable baseline | Resolved | The readiness implementation and its completion evidence are committed on the Phase 1 readiness branch and validated by the supported quality gate. | Closed |
| Nest logs are not consistently structured | Resolved | API and worker inject the shared Pino-backed Nest logger, including bootstrap and shutdown paths. | Closed |
| Correlation IDs, metrics, and integration tests are missing | Resolved | Shared async correlation context, bounded Prometheus metrics, unit tests, PostgreSQL integration tests, and process tests are present. | Closed |
| CI does not validate PostgreSQL or migrations | Resolved | CI provisions PostgreSQL 17, deploys migrations, runs database/process integration checks, and verifies migration status. | Closed |
| API and worker duplicate database/logger infrastructure | Resolved | Both applications compose one shared database lifecycle and one logger per process. | Closed |
| Startup, shutdown, and failure behavior is not explicitly tested | Resolved | Entry points report fatal startup errors and process tests cover unavailable PostgreSQL and graceful `SIGTERM` shutdown. | Closed |
| Domain packages and provider contracts are placeholders | Pending, planned | `core`, `market-data`, `strategy-engine`, `analytics`, `paper-trading`, and `execution` contain only placeholders. Provider contracts exist only in documentation. | First Phase 2 deliverable, not an entry blocker |
| Retention, lineage, and order-book reconstruction are not implemented | Pending, designed | Initial policies exist in the sprint plan, but no schema, jobs, manifests, or reconstruction code exists. | Must be resolved before high-volume ingestion, not before Sprint 2.1 |

## Readiness definition

Phase 2 may begin when:

- Remediation Blocks A, B, and C below are complete.
- The baseline is committed and `pnpm check` passes from a fresh clone.
- CI applies migrations and runs database integration tests against disposable PostgreSQL.
- API and worker start, report readiness, emit structured correlated logs, and stop cleanly.
- No production code path can enable live execution or place exchange orders.

Domain contracts are intentionally implemented in Block D as Sprint 2.1. High-volume ingestion may not begin until Block D and its data-design gate are complete.

## Block A: Establish a stable baseline

### Objective

Make the current Phase 0/1 work reviewable, reproducible, and safe to extend.

### Tasks

1. Review the complete pending diff for secrets, local paths, generated files, and accidental documentation formatting.
2. Confirm `.env` is ignored and `.env.example` contains no real credentials.
3. Run migration status against the configured local PostgreSQL without printing `DATABASE_URL`.
4. Run `pnpm check`, Markdown-link validation, and Prisma schema validation.
5. Split the pending changes into intentional commits where practical:
   - architecture decisions and governance documentation;
   - workspace/tooling and CI skeleton;
   - API, worker, dashboard, and shared configuration/logging skeleton;
   - Prisma schema and initial migration;
   - PostgreSQL-local and sprint/readiness documentation.
6. Re-run the complete checks after the commits and require a clean worktree.
7. Tag or otherwise record the Phase 1 baseline commit in the roadmap completion evidence.

### Acceptance

- `git status --short` is empty.
- The committed repository contains no `.env`, credentials, database passwords, or generated build output.
- A fresh clone can install, generate Prisma, run checks, and start with a separately supplied `.env`.
- The roadmap identifies the exact Phase 1 baseline commit.

## Block B: Runtime, observability, and lifecycle hardening

### Objective

Give API and worker one coherent operational model before adding long-running exchange connections.

### B1. Structured logging

Tasks:

- Implement a Nest `LoggerService` adapter backed by the existing Pino factory, or adopt a single Nest/Pino integration that accepts the same redaction configuration.
- Configure API and worker to use that logger during bootstrap; remove default Nest text logs and duplicate worker logger creation.
- Standardize fields: `app`, `environment`, `correlationId`, `operation`, `component`, `durationMs`, and error details.
- Serialize errors with stack traces without serializing secrets or complete exchange payloads by default.
- Add tests proving redaction of database URLs, authorization headers, exchange keys, secrets, and cookies.

Acceptance:

- Every API and worker log line is valid structured JSON when `LOG_FORMAT=json`.
- Bootstrap, Nest framework, HTTP, database, and worker logs use the same base fields and level policy.
- Secret-redaction tests cover nested request and error objects.

### B2. Correlation context

Tasks:

- Add a project-owned correlation context based on `AsyncLocalStorage`.
- Accept a valid incoming `x-correlation-id` or generate a UUID at the API boundary.
- Return the effective ID in the response header.
- Make the ID available to logs and application services without passing it through every method signature.
- Define a separate `runId`/`jobId` field for future worker operations and preserve the originating correlation ID when work crosses a boundary.
- Test concurrent requests to prove IDs do not leak between asynchronous contexts.

Acceptance:

- All logs produced during one request contain the same correlation ID.
- Concurrent test requests retain different IDs.
- Invalid or oversized incoming IDs are replaced safely.

### B3. Metrics and health

Tasks:

- Add Prometheus-compatible metrics using a small project-owned wrapper around `prom-client`.
- Record process health, uptime, HTTP count/duration, errors, database readiness, worker heartbeat, and graceful-shutdown count.
- Expose API metrics without secrets or unbounded labels.
- Choose and document a worker operational endpoint. Recommended: a minimal local health/metrics listener on a separate configurable port, with liveness and PostgreSQL readiness.
- Use injected clocks in health responses where deterministic testing is useful.
- Document metric names and label-cardinality rules.

Acceptance:

- API and worker have independently testable liveness and readiness signals.
- PostgreSQL failure changes readiness but not liveness.
- Metrics never use market symbol, error message, request path parameters, or correlation ID as unbounded labels.

### B4. Startup and graceful shutdown

Tasks:

- Replace unhandled `void bootstrap()` calls with an entry-point wrapper that logs fatal startup errors, closes partially initialized resources, sets a non-zero exit code, and flushes logging transports.
- Make shutdown idempotent for `SIGINT` and `SIGTERM`.
- Define maximum shutdown time and behavior when cleanup exceeds it.
- Stop accepting new API requests before disconnecting Prisma.
- Stop worker intake before waiting for active operations and disconnecting Prisma.
- Add subprocess integration tests for invalid configuration, unavailable PostgreSQL, `SIGINT`, and `SIGTERM`.

Acceptance:

- Invalid configuration and failed database startup exit non-zero with one structured fatal error.
- Both applications exit within the configured shutdown deadline.
- Shutdown tests prove database disconnect and no duplicate cleanup.

## Block C: Shared infrastructure and PostgreSQL-backed CI

### Objective

Remove infrastructure duplication and make database behavior part of the automated quality gate.

### C1. Database boundary

Tasks:

- Create a focused `packages/database` workspace package for Prisma client creation, connection lifecycle, health probing, and test utilities.
- Keep Nest lifecycle adapters inside application composition so the database package does not depend on Nest.
- Export infrastructure types only; do not expose Prisma models as domain contracts.
- Replace API `PrismaService` inheritance and worker-owned `new PrismaClient()` with the shared factory/lifecycle.
- Ensure one Prisma client and one logger instance exist per application process.
- Update ADR-001 package inventory and architecture documentation.

Acceptance:

- API and worker use the same tested database lifecycle implementation.
- Domain packages do not import `@prisma/client` or `packages/database`.
- Unit tests can inject a fake database health probe without connecting to PostgreSQL.

### C2. PostgreSQL integration tests

Tasks:

- Add a PostgreSQL service container to GitHub Actions with a dedicated test user and database.
- Set a CI-only `DATABASE_URL`; never reuse development or production credentials.
- Run `prisma migrate deploy` before integration tests and assert `prisma migrate status` is current.
- Add tests for application connection, readiness success/failure, Prisma lifecycle, and a `PlatformEvent` write/read round trip.
- Isolate tests by database/schema and clean data deterministically.
- Add a migration test that creates an empty database and applies the complete migration history.

Acceptance:

- CI fails if PostgreSQL is unavailable, a migration is invalid, or application/database contracts diverge.
- Tests do not depend on the developer's local PostgreSQL.
- A clean database can reach the current schema using committed migrations only.

### C3. Supported quality commands

Tasks:

- Add explicit `test:unit`, `test:integration`, and `test:all` scripts.
- Make `pnpm check` run unit tests everywhere and integration tests when the CI PostgreSQL environment is available.
- Add the Markdown-link validator as a committed script and CI step.
- Remove pnpm/Turbo invocation ambiguity so supported commands work through the package manager pinned in `packageManager`.
- Document local commands and expected prerequisites.

Acceptance:

- One documented command reproduces the CI quality gate locally against a disposable test database.
- Unit tests remain runnable without PostgreSQL.
- CI logs clearly separate formatting, lint, types, unit, integration, migration, and build failures.

## Block D: Controlled entry into Phase 2

### Objective

Replace placeholder domain packages and freeze data contracts before exchange adapters or high-volume tables are implemented.

This block is Sprint 2.1, not a prerequisite for starting Sprint 2.1.

### D1. Package foundations

Tasks:

- Initialize `packages/core` and `packages/market-data` with package manifests, strict TypeScript, lint, test, and build scripts.
- Add dependency-boundary rules: core imports no infrastructure; market-data may depend on core but not on apps, Prisma, Nest, or CCXT contracts.
- Remove placeholder files only when each package has a compiled public entry point and tests.
- Leave analytics, paper-trading, execution, and full strategy-engine initialization to their scheduled phases.

Acceptance:

- Workspace checks exercise both new packages.
- Architecture tests reject forbidden dependencies.

### D2. Exact value and time contracts

Tasks:

- Implement decimal-backed `Price`, `Quantity`, `Money`, `FeeRate`, and PnL value objects according to ADR-003.
- Implement timestamps that preserve `eventTime`, `receivedAt`, `processedAt`, source precision, and sequence metadata according to ADR-004.
- Define venue, canonical instrument, venue market, trading rules, fee snapshot, ticker, trade, candle, and order-book contracts.
- Require explicit units, currency/instrument context, rounding, and serialization.
- Add property-based or boundary-heavy tests for precision, rounding, timestamp ordering, and serialization round trips.

Acceptance:

- Financial values cannot enter core calculations as uncontrolled JavaScript `number` values.
- Mixed currency/instrument operations fail explicitly.
- Timestamp precision is preserved without fabricating microseconds.

### D3. Provider and data-design gate

Tasks:

- Convert documented provider interfaces into compiled contracts with capability and typed-error models.
- Split public market-data access, authenticated account reads, historical access, and future execution into separate capabilities.
- Ensure Phase 2 authenticated providers cannot place or cancel orders at the type level.
- Finalize raw-envelope, normalized-event, fee-version, metadata-version, idempotency, and dataset-lineage schemas before ingestion migrations.
- Benchmark representative Binance/Kraken payload volumes before fixing retention and order-book snapshot intervals.
- Record or update ADRs if implementation choices alter the sprint plan's retention assumptions.

Acceptance:

- Contract tests can be reused unchanged by Binance and Kraken adapters.
- No Phase 2 interface exposes an order-submission method.
- The high-volume schema review records expected rows/bytes per market/day and retention consequences.

## Execution order

Complete the work sequentially:

1. Block A: stable baseline.
2. Block B1 and B2: one logger and correlation context.
3. Block C1: shared database lifecycle.
4. Block B3 and B4: health, metrics, startup, and shutdown.
5. Block C2 and C3: PostgreSQL integration tests and CI quality gate.
6. Declare Phase 1 complete with recorded evidence.
7. Block D: Sprint 2.1 domain and provider foundations.

B and C are split by dependency rather than completed as isolated large batches. Correlation and logger foundations come before lifecycle/metrics instrumentation; the shared database boundary comes before database integration tests.

## Verification matrix

| Concern | Unit | Integration | Subprocess/E2E | CI evidence |
| --- | --- | --- | --- | --- |
| Configuration and secret redaction | Required | Optional | Invalid startup | Required |
| Logger and correlation isolation | Required | Concurrent HTTP requests | API request | Required |
| Prisma lifecycle and readiness | Fake probe | Real PostgreSQL | API/worker startup | Required |
| Migrations | Not applicable | Empty database migration | App against migrated DB | Required |
| Metrics and health | Registry assertions | PostgreSQL up/down | HTTP probes | Required |
| Shutdown | State-machine tests | Active DB connection | `SIGINT`/`SIGTERM` | Required |
| Domain precision and time | Required | Serialization/persistence later | Not applicable | Required |
| Provider capability safety | Contract tests | Authenticated read in Sprint 2.2 | Safe connectivity CLI | Required where credentials are available |

## Explicitly deferred

The readiness work does not include:

- Binance or Kraken connectivity;
- CCXT;
- market-data ingestion;
- order-book persistence;
- strategy implementation;
- application authentication or login;
- order placement, cancellation, withdrawals, paper trading, or live execution.

These remain in their scheduled sprints. Keeping them out of readiness prevents infrastructure hardening from turning into an unbounded Phase 2 implementation.

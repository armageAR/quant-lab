# Definition of Done

A feature is done only when the applicable criteria below are satisfied. If a criterion does not apply, the pull request should state why.

## Behavior and quality

- Acceptance criteria are met and important edge cases are handled.
- Unit, integration, contract, or end-to-end tests cover the change at the appropriate boundary.
- Input, configuration, and external data are validated.
- Expected failures have explicit handling; errors are actionable and do not leak secrets.
- Formatting, linting, type checking, tests, and builds pass in CI.

## Operations

- Structured logs provide enough context to diagnose failures without exposing credentials or sensitive data.
- Relevant metrics, traces, health checks, and alerts are added or updated.
- Timeouts, retries, idempotency, rate limits, and reconciliation behavior are defined where external systems are involved.
- Security, permissions, execution risk, and rollback behavior have been reviewed.

## Data and architecture

- Database changes include a reviewed migration and a safe rollout or rollback plan when applicable.
- Financial values follow the numeric precision ADR; temporal values follow the clock model ADR.
- Public contracts, domain invariants, and compatibility impact are documented.
- An ADR is created or updated when the change alters an architectural decision, dependency boundary, or significant trade-off.

## Documentation and delivery

- User, operator, API, configuration, and architecture documentation is updated as applicable.
- Feature flags and environment variables are documented with safe defaults and removal criteria.
- The pull request explains verification evidence, operational impact, and any intentionally deferred work.
- Temporary code, debug output, and obsolete flags are removed.

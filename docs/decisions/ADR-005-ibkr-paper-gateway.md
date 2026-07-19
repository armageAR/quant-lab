# ADR 005: IBKR paper gateway integration

- Status: Accepted
- Date: 2026-07-18

## Context

Phase 6 adds US stocks and ETFs through Interactive Brokers while the product is
still proving strategies in paper trading. The integration must not reuse crypto
symbols as instrument identity, leak broker details into the strategy domain, or
make live execution possible through an accidental default.

IBKR identifies instruments with `conId` and exposes the TWS API through either
Trader Workstation or IB Gateway. Connectivity is stateful and subject to session,
pacing, reconnect, order-id, and account constraints.

## Decision

- Integrate the TWS API through the Node-compatible `@stoqey/ib` client, isolated
  behind interfaces in `@quant-lab/ibkr-adapter`.
- Use IB Gateway or TWS paper endpoints only. The allowed ports are `4002` and
  `7497`; any other port fails configuration validation.
- Permit authenticated live market-data diagnostics only through the separate
  `live-readonly` profile on ports `4001` or `7496`. This profile requires
  `IBKR_READ_ONLY=true`, forbids paper execution, and is never represented as a
  paper session.
- Treat `conId` as the canonical broker instrument identifier. Persist versioned
  contract metadata and map it to domain instruments outside strategy code.
- Require an explicit paper account, client id, contract allowlist, and connectivity
  flag. Connectivity and paper order routing use separate flags and both default
  to disabled.
- Keep local simulation, local paper trading, and IBKR paper execution as distinct
  execution providers with shared strategy inputs and comparable audit records.
- Store broker event, reception, and processing timestamps according to ADR 004.
- Apply request pacing, bounded timeouts, reconnect handling, idempotent order
  references, and reconciliation before any order-routing capability is enabled.
- Never expose credentials or full account identifiers through API responses or
  logs. There are no safe defaults for account identity or execution enablement.

## Consequences

The strategy engine remains broker-neutral and tests can substitute a deterministic
gateway client. A real connectivity check still requires a locally running TWS or
IB Gateway session configured for API access. The third-party protocol client is a
replaceable infrastructure dependency and must not appear in domain interfaces.

Live IBKR execution is explicitly outside this phase. Adding it requires a new ADR,
separate credentials and account controls, and an independent operational review.

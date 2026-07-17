# ADR-002: Crypto-first, Multi-market Domain

## Status

Accepted

## Date

2026-07-17

## Context

Quant Lab needs a narrow initial scope that can produce useful research workflows quickly. Binance and Kraken provide liquid crypto markets, continuous trading, accessible market data, and sufficiently different APIs to test the provider abstraction. CCXT also reduces the cost of the first integrations.

Crypto is only the first delivery market. The intended platform also includes equities, ETFs, forex, futures, options, and broker integrations such as IBKR. Encoding crypto assumptions in core entities would make that expansion expensive and could produce invalid behavior for instruments with sessions, expiries, multipliers, or different settlement rules.

## Decision

Implement Binance and Kraken first through CCXT-backed adapters, while keeping the domain market-neutral.

- Core concepts use `Venue`, `Instrument`, `Market`, `Order`, `Fill`, `Position`, and `Portfolio`, not crypto-specific equivalents.
- Instruments declare asset class, base/quote or contract identifiers, precision, trading constraints, settlement, and venue metadata explicitly.
- Trading calendars, market sessions, contract multipliers, expiries, and settlement rules remain extensible capabilities, even when the first crypto venues do not require them.
- Strategies declare supported markets and required venue capabilities. They do not import CCXT or venue SDK types.
- Provider contracts expose normalized data and execution semantics. Raw venue payloads remain inside adapters or are retained separately for audit and replay.
- Venue-specific symbols, order types, precision rules, fees, and authentication remain behind adapters.
- “Crypto-first” determines delivery order, not the boundaries of the domain model.

## Alternatives considered

- Build a crypto-only domain and generalize it after product validation.
- Support crypto and traditional markets from the first release.
- Start with IBKR instead of crypto exchanges.

## Consequences

- Initial implementation stays focused on Binance and Kraken.
- Core models require slightly more explicit metadata than a crypto-only design.
- Adding a new asset class should primarily require capabilities and adapters rather than replacement of core entities.
- CCXT is an integration detail and can be replaced without changing strategy contracts.

## Risks

- Premature abstractions may model future markets incorrectly.
- A lowest-common-denominator provider interface could hide important venue capabilities.
- Crypto assumptions may still leak through naming, fixtures, or database constraints.

## Follow-up work

- Add contract tests for Binance and Kraken adapters.
- Validate the domain model against representative spot, derivative, and session-based instruments before database models are finalized.
- Record separate ADRs when a new asset class introduces semantics that do not fit existing contracts.

# IBKR

Interactive Brokers is planned after the Phase 6 strategy foundation. The first
scope is US-listed stocks and ETFs using real data, local paper trading, and the
IBKR paper simulator. See the
[IBKR paper-trading plan](../ibkr-paper-trading-plan.md). ADRs, Argentine markets,
and live orders remain deferred.

## Why it is future scope

- it is broker-mediated rather than exchange-native in the same way as crypto venues;
- it has a richer and more complex instrument model;
- market hours and trading sessions matter;
- account and order lifecycle rules are more operationally demanding;
- regulatory and approval requirements are more involved.

## Expected differences from crypto exchanges

- instruments are contracts, not only spot pairs;
- market availability depends on session and venue rules;
- order types, routing, and statuses may differ;
- account permissions and compliance constraints are stricter;
- settlement and corporate-action effects may matter.

## Instrument model implications

The architecture should preserve:

- a generalized `Instrument` model;
- venue-specific metadata;
- market-hours awareness;
- contract and multiplier support;
- a distinction between the venue symbol and the normalized instrument identity.

## Market hours

Unlike crypto, many IBKR instruments are subject to market sessions, holidays, pre-market and after-hours behavior, and venue-specific trading windows. The system should be able to represent these constraints even before IBKR integration is built.

## Subscriptions

Future provider contracts should be able to represent:

- market data subscriptions;
- account subscriptions;
- order status updates;
- fill updates;
- clock or session-state checks.

## Order lifecycle

IBKR may require a more explicit order state model than the initial crypto venues. The architecture should preserve order submit, acknowledgement, partial fill, cancel, rejection, and reconciliation states.

## Account model

The platform should assume that broker accounts can have:

- permissions per instrument class;
- margin and buying-power concepts;
- currency-specific balances;
- settlement constraints.

## Regulatory and operational complexity

Future IBKR support may require:

- additional approval workflows;
- stronger audit trails;
- explicit human approval for live changes;
- more careful credential and permission handling.

## Architectural requirements to preserve now

- keep broker-specific behavior behind adapters;
- keep strategy logic independent of the venue type;
- keep execution semantics compatible across paper and live paths;
- keep the instrument model general enough for non-crypto assets.

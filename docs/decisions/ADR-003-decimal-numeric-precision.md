# ADR-003: Decimal and Numeric Precision

## Status

Accepted

## Date

2026-07-17

## Context

Binary floating-point arithmetic cannot exactly represent many decimal values. Uncontrolled use of JavaScript `number` for financial values can therefore corrupt comparisons, rounding, accounting identities, order validation, fees, and PnL.

The persistence, domain, transport, and high-volume analytical layers have different requirements. The policy must be fixed before Prisma models and public contracts are created, even if individual storage scales are refined later.

## Decision

Money, prices, quantities, notional values, fees, balances, rates, percentages, and realized or unrealized PnL must not use JavaScript `number` or uncontrolled binary floating point.

- API and event boundaries represent exact decimal values as canonical decimal strings plus an explicit currency, unit, or instrument context.
- Domain calculations use `decimal.js` behind project-owned value objects. Rounding mode and scale must be explicit at the operation boundary.
- Prisma persistence uses `Decimal` backed by PostgreSQL `numeric(p, s)`. Precision and scale are chosen per field from venue constraints and documented in migrations.
- Prisma `Decimal` values do not cross repository boundaries; persistence adapters convert them to and from domain value objects.
- Scaled integers may be used in performance-sensitive or protocol-specific paths only when the scale is explicit, immutable for the value, range-safe, and covered by conversion tests.
- JavaScript `number` is permitted for counts, indexes, bounded configuration that is not financial, and explicitly approximate analytics. Approximate results must not feed accounting, risk limits, or execution decisions without exact conversion and validation.
- Values are quantized using venue tick size, lot size, currency minor units, and declared rounding rules. Strategies must not invent precision.
- Serialization, equality, aggregation, and database round trips require tests at boundary values.

## Alternatives considered

- Use JavaScript `number` with rounding helpers.
- Use Prisma `Decimal` throughout every layer.
- Use scaled integers for every financial value.
- Store all values as strings and calculate only in the database.

## Consequences

- Financial arithmetic is deterministic and reviewable across domain and persistence layers.
- External contracts remain language-neutral and avoid JSON number ambiguity.
- Conversion code is concentrated in adapters and value objects.
- Decimal arithmetic and serialization add implementation and performance cost.

## Risks

- Incorrect database precision or scale can still truncate valid venue values.
- Mixing `Decimal`, strings, scaled integers, and `number` can reintroduce silent coercion.
- Rounding rules may differ by venue, instrument, operation, or fee currency.

## Follow-up work

- Implement and test domain value objects for decimal quantities, money, prices, rates, and PnL.
- Define the precision and scale of each Prisma field before its migration is accepted.
- Add linting or static-analysis rules that flag financial fields typed as `number`.
- Benchmark decimal arithmetic before introducing any scaled-integer optimization.

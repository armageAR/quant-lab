# ADR-004: Time and Clock Model

## Status

Accepted

## Date

2026-07-17

## Context

Market data and execution events cross exchange, network, queue, worker, and persistence boundaries. A single timestamp cannot distinguish when an event occurred from when Quant Lab observed or processed it. Clock drift and timestamp precision also differ by venue and transport.

Without an explicit clock model, ordering, latency analysis, replay, reconciliation, and backtest reproducibility become unreliable.

## Decision

Store and process all timestamps in UTC. Persist instants as timezone-aware values and serialize them as ISO 8601 UTC strings. Do not use local time for stored events or ordering.

Every externally sourced event should carry these timestamps when applicable:

- `eventTime`: when the exchange or upstream source says the event occurred.
- `receivedAt`: when Quant Lab first received the event at its ingestion boundary.
- `processedAt`: when Quant Lab completed the processing step that produced the stored record or downstream event.

Additional rules:

- Preserve the source timestamp value and its original precision when available.
- Normalize timestamps to epoch microseconds internally and in persistence where the source supports them; millisecond sources remain millisecond-precision values and must not gain fabricated precision.
- Include timestamp precision or source metadata when it cannot be inferred safely.
- Use a monotonic clock for elapsed durations within a process. Wall-clock UTC is for interoperable instants, not duration measurement.
- Measure clock drift using exchange server-time endpoints where available. Record drift, sampling time, and uncertainty; alert when configured thresholds are exceeded.
- Never silently substitute `receivedAt` for a missing `eventTime`. Missing source time is explicit data-quality state.
- Order events using venue sequence identifiers when available. Timestamp ordering alone is not assumed to be total or unique.
- Inject a clock into domain workflows and tests rather than calling the system clock from deterministic logic.

## Alternatives considered

- Store only the exchange timestamp.
- Store only the local ingestion timestamp.
- Standardize every value to milliseconds and discard higher precision.
- Use local server time without drift measurement.

## Consequences

- Ingestion and processing latency can be measured separately.
- Replays and incident analysis retain source timing and local observation timing.
- Events and database models carry more fields and metadata.
- Consumers must define ordering and missing-time behavior explicitly.

## Risks

- Exchange clocks may jump or report misleading precision.
- Database or JavaScript conversions may silently lose microseconds.
- Distributed services may record inconsistent times if host synchronization is unhealthy.

## Follow-up work

- Define shared timestamp types and serialization tests.
- Select PostgreSQL column mappings that preserve required precision.
- Add clock drift, ingestion lag, and processing lag metrics per venue.
- Add fixtures for missing, duplicated, out-of-order, and mixed-precision timestamps.

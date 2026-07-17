# Order-book reconstruction

## Synchronization model

- A snapshot is required before any delta can produce a valid book.
- Binance deltas carry the previous update id (`pu`) as `previousSequence` and the final update id (`u`) as `sequence`.
- Kraken deltas use their channel sequence when available and provide the venue checksum to the engine checksum verifier.
- A missing sequence, failed checksum, empty side, crossed book, or stale book invalidates the current book. Consumers must wait for a new snapshot rather than use partial depth.
- Raw envelopes, normalized snapshots, ordered deltas, and invalidation reasons are persisted independently.

## Defaults

- In-memory and API depth: 100 levels per side; API callers may request at most 1,000.
- Snapshot capture: every ingestion/backfill run and after every invalidation or reconnect.
- Staleness: 5 seconds unless the runtime supplies a market-specific threshold.
- Reconstruction: latest snapshot at or before the requested instant plus at most 10,000 ordered events.
- Retention: 90 days, aligned with market-event retention. Dataset pinning in Sprint 2.6 must protect evidence before deletion.

These defaults prioritize deterministic research evidence over maximum depth. They must be changed from measured storage, processing latency, and opportunity-size requirements, not by silently changing consumer behavior.

## API

`GET /markets/order-book?marketId=BINANCE:BTCUSDT&depth=100&at=<ISO-8601>` reconstructs executable price/quantity levels at an instant. An absent snapshot returns no book; an invalid reconstruction returns `valid: false` and its reason.

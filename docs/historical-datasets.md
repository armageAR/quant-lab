# Historical datasets

Historical dataset manifests freeze research evidence before analysis. A manifest identity is derived from its schema version, sorted markets, UTC range, ordered source envelope identifiers, and source checksums.

## Lifecycle

1. Create a manifest for one or more markets and a bounded UTC range.
2. Validate source gaps, missing event timestamps, crossed ticker spreads, and recorded order-book invalidations.
3. Pin accepted evidence so retention cannot delete its raw source envelopes.
4. Export ordered NDJSON for offline research or archival.
5. Compact only after the manifest is pinned and exported.

Creation is idempotent. The same inputs and source evidence produce the same dataset ID and checksum. Adding or removing source evidence produces a different identity rather than mutating an existing manifest.

## CLI

```bash
pnpm dataset create --markets=BINANCE:BTCUSDT,KRAKEN:XBTUSDT --from=2026-07-17T00:00:00Z --to=2026-07-17T01:00:00Z
pnpm dataset validate --id=dataset_ID --max-gap-ms=60000
pnpm dataset pin --id=dataset_ID
pnpm dataset export --id=dataset_ID --directory=data/exports
pnpm dataset inspect --id=dataset_ID
pnpm dataset compact --id=dataset_ID
```

## API

- `POST /datasets`
- `GET /datasets/:id`
- `GET /datasets/:id/events?limit=100&afterOrdinal=99`
- `POST /datasets/:id/validate`
- `POST /datasets/:id/pin`
- `POST /datasets/:id/export`
- `POST /datasets/:id/compact`

Validation returns `valid: false` when source gaps or order-book invalidations exceed the configured acceptance. Warnings such as unavailable exchange event timestamps remain visible without silently inventing timestamps.

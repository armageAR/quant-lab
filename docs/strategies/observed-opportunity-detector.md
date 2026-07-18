# Observed opportunity detector

The observed detector compares fresh normalized Binance and Kraken order books for the same canonical spot instrument. It evaluates both directions independently and persists every observed or rejected result with exact book-event references and an immutable configuration fingerprint.

## Classification

- `observed`: the sell venue best bid exceeds the buy venue best ask by at least the configured raw spread threshold.
- `rejected`: one or both books are invalid, stale, missing a quote, too far apart in receive time, or below the configured threshold.

`observed` never means executable or profitable. This sprint does not apply fees, order-book depth, minimum notionals, inventory, slippage, latency buffers, fills, or rebalancing costs. Those constraints belong to Sprint 3.2.

## Reproducibility

Every stored evaluation includes:

- detector ID, semantic version, configuration and fingerprint;
- canonical instrument and direction;
- exact buy and sell order-book event IDs;
- evaluated time, individual freshness and cross-venue skew;
- buy ask, sell bid and exact decimal raw spread when quotes are valid;
- rejection reason when classification is `rejected`.

## Commands

Run after fresh order-book ingestion:

```bash
pnpm market:ingest
pnpm opportunity:detect
```

Configuration variables:

- `OBSERVED_DETECTOR_VERSION` defaults to `1.0.0`.
- `OBSERVED_MAX_BOOK_AGE_MS` defaults to `5000`.
- `OBSERVED_MAX_SKEW_MS` defaults to `1000`.
- `OBSERVED_MIN_SPREAD` defaults to `0` and must be an exact decimal string.

Query `GET /opportunities` or open `/opportunities` in the dashboard. Triggering `POST /opportunities/evaluate` runs one evaluation using the supplied versioned configuration.

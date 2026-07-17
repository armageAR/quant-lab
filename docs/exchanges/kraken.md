# Kraken

Kraken is one of the initial venues for Quant Lab and a core source for cross-exchange crypto arbitrage research.

## Intended integration method

- Use CCXT for the initial normalized integration layer.
- Keep Kraken-specific handling in a venue adapter.
- Preserve a clean boundary for REST and streaming behavior.

## CCXT role

CCXT should provide the same broad contract used for Binance:

- market metadata;
- symbol and precision information;
- read-only account, permission, balance, and effective-fee access;
- common response normalization.

## REST use cases

- market discovery;
- tickers;
- candles;
- trades;
- order books;
- balances;
- API-key permission inspection and balances.

## Phase 2 safety

The adapter calls Kraken `GetApiKeyInfo` before authenticated account reads and rejects trading, cancellation, deposits, Earn, withdrawals, or withdrawal-address permissions. Kraken Spot has no CCXT sandbox endpoint; `KRAKEN_SANDBOX=true` is rejected instead of silently connecting to production.

## WebSocket use cases

- live market updates;
- order-book maintenance;
- trade feeds;
- execution or account updates when available.

## Symbol normalization concerns

- internal canonical symbols should not mirror venue formatting blindly;
- quote currency and pair ordering may differ across markets;
- derivatives and spot instruments should be distinguished explicitly.

## Precision and minimum sizes

Precision, lot sizing, and minimum order sizes must come from exchange metadata or configuration. Strategy logic must treat them as constraints.

## Rate limits

Do not hard-code exact rate limits in the repository unless they are confirmed by official documentation and kept current. Prefer metadata-driven configuration.

## Fees

Maker and taker fees, withdrawal fees, and tier rules must be represented as versioned inputs to research and execution.

## Timestamps

Store venue timestamps separately from local ingest timestamps. Time alignment is required for order-book and arbitrage analysis.

## Order-book handling

- preserve snapshot freshness;
- handle partial order-book data carefully;
- model depth and price impact explicitly;
- mark stale or invalid snapshots instead of silently accepting them.

## Reconnect behavior

Streaming consumers should detect disconnects, resubscribe, and request fresh snapshots or backfills as needed.

## Data quality concerns

- missing updates;
- delayed snapshots;
- inconsistent sequencing;
- market state transitions;
- symbol mapping changes;
- historical gaps affecting reproducibility.

## Known implementation risks

- differences between exchange-specific and normalized market semantics;
- assumptions about fills that do not survive simulation;
- latency sensitivity for arbitrage research;
- using stale data as if it were current;
- underestimating the effect of fees and minimum sizes.

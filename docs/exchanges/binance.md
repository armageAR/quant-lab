# Binance

Binance is one of the initial venues for Quant Lab and the first target for cross-exchange crypto research.

## Intended integration method

- Use CCXT as the primary adapter layer for normalized market metadata and REST-based access.
- Keep Binance-specific behavior behind a venue adapter.
- Preserve a path for future exchange-native streaming if the research workflow needs it.

## CCXT role

CCXT should provide:

- market discovery;
- normalized symbols where possible;
- read-only account, permission, balance, and effective-fee access;
- common metadata and precision helpers.

Any Binance-specific edge cases should still be handled in the adapter layer rather than spread into strategy code.

## REST use cases

- load market metadata;
- fetch tickers;
- fetch order books;
- fetch trades;
- fetch candles;
- inspect API-key restrictions and retrieve balances without modifying account state.

## Phase 2 safety

The adapter calls Binance API-key restrictions before authenticated account reads. Keys with spot/margin/futures trading or withdrawal permission are rejected. Binance Spot testnet is selected only when `BINANCE_SANDBOX=true`, before any other CCXT call.

## WebSocket use cases

- live ticker updates;
- order-book deltas or snapshots;
- trade streams;
- execution updates when available.

If streaming support is added later, it should be isolated behind the provider interface and not leak into strategies.

## Symbol normalization concerns

- symbol names may differ from internal canonical symbols;
- contract and quote conventions may vary;
- instrument state may differ between spot and derivatives markets.

## Precision and minimum sizes

Precision, tick size, lot size, and minimum order size must come from exchange metadata or explicit configuration. They should never be guessed in strategy code.

## Rate limits

Do not hard-code rate-limit values here. Load them from exchange metadata, CCXT behavior, or configuration, and verify them against official documentation during implementation.

## Fees

Fee schedules must be loaded from official metadata or configuration. Backtests should store the exact fee assumptions used.

## Timestamps

Data freshness and clock alignment matter. Store venue timestamps, ingest timestamps, and any clock-offset measurements separately when possible.

## Order-book handling

- preserve sequence or snapshot metadata when available;
- reject or mark stale snapshots;
- model depth explicitly for slippage and fill estimates;
- avoid assuming top-of-book prices are fully executable.

## Reconnect behavior

Any streaming connector should define reconnect, backfill, and stale-feed handling. The system should be able to detect feed interruption and stale data.

## Data quality concerns

- temporary feed gaps;
- symbol mapping drift;
- duplicate updates;
- stale snapshots;
- metadata changes after market listing or delisting;
- inconsistent precision data.

## Known implementation risks

- venue-specific symbol quirks;
- fee and precision mismatches;
- differences between observed and executable prices;
- assumptions about fill quality that do not hold in production;
- reliance on live data without historical backfill coverage.

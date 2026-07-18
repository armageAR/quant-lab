# Executable opportunity detector

The executable detector extends the [observed detector](./observed-opportunity-detector.md) from a raw spread signal into an estimate of realizable net profit. For each canonical spot instrument it aligns fresh Binance and Kraken order books, evaluates both directions independently, and walks order-book depth to price a configured set of trade sizes. It applies effective taker fees, a symmetric slippage safety buffer, venue trading rules, and configured inventory before deciding whether an edge is executable.

All arithmetic uses exact decimals. This detector performs research classification only; it never places, simulates, or promises an order.

## Classification

Each direction is classified as exactly one of:

- `executable`: at least one configured size fills fully within depth, satisfies every venue and inventory constraint, and reaches the configured minimum net-profit rate.
- `missed`: at least one size would be net-profitable if it filled, but every profitable size is blocked by a venue or inventory constraint (minimum quantity, maximum quantity, minimum notional, or insufficient inventory).
- `observed`: the books were evaluated but no size reaches the net-profit threshold after fees, slippage, and depth.
- `rejected`: the books could not be evaluated (invalid, missing a quote, stale, or beyond the cross-venue skew limit).

Profit is reported only for the `executable` classification. When a leg breaches a venue or inventory constraint the detector cannot report profit, matching the Sprint 3.2 acceptance criteria.

## Profit model

For a target base quantity, the detector walks the buy venue asks and sell venue bids to compute volume-weighted fills:

- `buyNotional` and `sellNotional` are the exact quote amounts required and received.
- `grossProfit = sellNotional - buyNotional`.
- `feeCost = buyNotional * buyTakerFee + sellNotional * sellTakerFee`.
- `slippageCost = (buyNotional + sellNotional) * slippageBufferRate`.
- `netProfit = grossProfit - feeCost - slippageCost`.
- `netProfitRate = netProfit / buyNotional`.

Each configured size produces one entry in the persisted profit curve (`sizeEvaluations`), recording its fill, the gross/fee/slippage/net breakdown, whether it is profitable, whether it is viable, and any blocking reasons. The stored `maxExecutableSize` is the largest viable and profitable size.

## Inventory

Inventory is a configuration map of `venueId -> currency -> available amount`. A venue absent from the map is treated as unconstrained, which is convenient for pure fee-and-depth research. A venue present in the map enforces every currency it lists; a currency missing from a present venue is treated as a zero balance. The buy leg must hold enough quote currency to cover the buy notional plus fees and the slippage buffer; the sell leg must hold the traded base quantity.

Because inventory is part of the versioned configuration fingerprint, every evaluation remains reproducible from persisted input references and detector configuration.

## Commands

Run after fresh order-book ingestion:

```bash
pnpm market:ingest
pnpm opportunity:detect:executable
```

The continuous observation worker also runs executable detection each cycle when `EXECUTABLE_DETECTOR_ENABLED=true`.

Configuration variables:

- `EXECUTABLE_DETECTOR_ENABLED` gates the continuous stage; defaults to `false`.
- `EXECUTABLE_DETECTOR_VERSION` defaults to `1.0.0`.
- `EXECUTABLE_MAX_BOOK_AGE_MS` defaults to `5000`.
- `EXECUTABLE_MAX_SKEW_MS` defaults to `1000`.
- `EXECUTABLE_TRADE_SIZES` is a comma-separated list of base quantities; defaults to `0.01,0.1,1`.
- `EXECUTABLE_SLIPPAGE_BUFFER` is an exact decimal rate; defaults to `0.0005`.
- `EXECUTABLE_LATENCY_BUFFER_MS` is recorded for latency studies; defaults to `250`.
- `EXECUTABLE_MIN_NET_PROFIT_RATE` is the exact decimal threshold; defaults to `0`.
- `EXECUTABLE_INVENTORY` is a JSON object; defaults to `{}`.

Query `GET /executable-opportunities` or open `/opportunities` in the dashboard. Triggering `POST /executable-opportunities/evaluate` runs one evaluation using the supplied versioned configuration.

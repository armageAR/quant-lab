# Research report and latency study

The research report turns persisted executable-opportunity evaluations into a quantitative view of whether detected edges survive realistic delays and costs. It lives in `@quant-lab/analytics` and is a pure, deterministic function of the evaluation rows, so the same inputs always produce the same report. This is what makes Phase 3 metrics reproducible from a dataset manifest.

The report performs research analysis only; it never places, simulates, or promises an order.

## Inputs and scope

A report is computed over persisted `ExecutableOpportunity` rows (see the [executable opportunity detector](./strategies/executable-opportunity-detector.md)). The scope can be:

- unbounded (all evaluations);
- a time window (`from`/`to`);
- a canonical symbol; or
- a dataset manifest (`datasetId`), which reuses the manifest time range and markets so the report is reproducible for a fixed manifest and detector configuration.

Rows are read in a deterministic order (`evaluatedAt`, then `id`).

## Metrics

- **Classification counts**: executable, missed, observed, and rejected.
- **False-positive rate**: apparent edges (positive top-of-book spread) that do not survive as executable, divided by apparent edges. This quantifies how fees, depth, and constraints remove apparent profit.
- **Gross-to-net attribution**: summed gross profit, fee cost, slippage cost, and net profit, plus the fee and slippage shares of gross. This shows where apparent profit is lost.
- **Latency study**: executable evaluations are grouped into episodes per `(symbol, direction)`; evaluations more than `episodeGapMs` apart start a new episode. The report records episode count, median and maximum duration, and how many episodes vanished faster than the simulated `submissionDelayMs` — the edges latency would remove.
- **Feed quality**: average and maximum feed age and cross-venue skew.
- **Distributions**: per-symbol, per-direction, and daily rollups (with executable net profit per day).
- **Backtest eligibility**: a gate that passes only when the executable count, false-positive rate, and median executable duration all satisfy the configured thresholds. Failing reasons are listed.

All decimal arithmetic is exact.

## Commands

```bash
# JSON report over all evaluations
pnpm research:report

# scoped and CSV variants
pnpm research:report --symbol=BTC/USD --from=2026-07-18T00:00:00Z
pnpm research:report --dataset=<manifestId>
pnpm research:report --csv > research-report.csv
```

The API exposes the same report at `GET /research/report` and a CSV export at `GET /research/report.csv`, both accepting `from`, `to`, `canonicalSymbol`, and `datasetId` query parameters. The dashboard `/opportunities` page renders the report summary, latency removal, gross-to-net attribution, data-quality warnings, and the backtest gate.

## Configuration

- `RESEARCH_SUBMISSION_DELAY_MS` is the simulated time to reach a venue; defaults to `1000`.
- `RESEARCH_EPISODE_GAP_MS` bounds the gap between consecutive executable evaluations in one episode; defaults to `20000`.
- `RESEARCH_MIN_EXECUTABLE_COUNT` is the minimum executable count for backtest eligibility; defaults to `10`.
- `RESEARCH_MAX_FALSE_POSITIVE_RATE` is the maximum tolerated false-positive rate; defaults to `0.9`.
- `RESEARCH_MIN_MEDIAN_DURATION_MS` is the minimum median executable episode duration; defaults to `1000`.

Backtest eligibility is a documented validation decision, not a runtime dependency. It marks whether a dataset is worth replaying in Phase 4; it never enables execution.

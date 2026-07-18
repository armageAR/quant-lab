# Backtesting and simulation

Phase 4 replays frozen dataset manifests through deterministic, versioned execution models. It is research-only: it does not connect to exchange order endpoints and cannot place live orders.

## Runtime model

The API persists experiments and queues runs. The worker polls PostgreSQL, claims one queued run atomically, replays it, checkpoints progress, and persists its output hash, metrics, fills, evidence, and validation decision. API requests therefore remain short even when a replay is long.

Run states are `queued`, `running`, `paused`, `completed`, `failed`, and `cancelled`. Pausing a running replay is cooperative at event checkpoints. Resuming deterministically recomputes from the beginning with the same dataset, configuration, seed, and models.

## Provenance and determinism

Every run records:

- experiment and frozen dataset manifest;
- code commit and integer seed;
- complete simulation configuration;
- replay, fill, fee, slippage, latency, and rebalancing model versions;
- stable output hash;
- exact decimal results represented as strings.

Dataset ordinals and received timestamps must be strictly monotonic. Missing usable timestamps, duplicate sources, backward time, and future-book access fail explicitly.

## Creating a run

### Dashboard workflow

Start the API, worker, and dashboard with `pnpm dev`, then open
`http://localhost:3001/backtests`. Set `APP_COMMIT_SHA` in the dashboard
environment to the commit being tested; the run form remains blocked when it
is unavailable.

1. In **Datasets**, select comparable markets and a bounded time range. Create,
   validate, and pin the immutable dataset.
2. In **Experiments**, record a name and testable hypothesis.
3. In **Configure**, select the dataset and experiment, review fees, fill
   assumptions, seed, model versions, and validation thresholds.
4. Review the immutable JSON and queue one run, or queue the bounded base,
   conservative, and adverse sweep.
5. In **Runs**, filter and refresh the queue, pause/resume/cancel eligible work,
   inspect metrics and evidence, select two to ten runs, or download CSV.
6. In **Compare**, interpret differences together with dataset and provenance.

The browser sends all financial inputs as decimal strings. Dates are shown in
GMT-3 while dataset requests are serialized as UTC. The dashboard uses
same-origin `/api/backend/*` routes, so `API_INTERNAL_URL` is never exposed to
browser code.

### API fallback

Create an experiment:

```bash
curl -X POST http://localhost:3000/backtests/experiments \
  -H 'content-type: application/json' \
  -d '{"name":"BTC cross-venue baseline","hypothesis":"Net arbitrage survives realistic spot execution"}'
```

Queue a run using the returned experiment id and a frozen dataset id:

```bash
curl -X POST http://localhost:3000/backtests/runs \
  -H 'content-type: application/json' \
  -d '{
    "experimentId":"<experiment-id>",
    "datasetId":"<dataset-id>",
    "seed":1,
    "codeCommit":"<git-commit>",
    "modelVersions":{"replay":"1.0.0","fill":"fill-v1","fees":"1.0.0","latency":"1.0.0","rebalancing":"1.0.0"},
    "configuration":{
      "scenario":"conservative",
      "tradeSize":"0.01",
      "orderType":"market",
      "submissionDelayMs":250,
      "cancelAfterMs":2000,
      "feeRates":{"BINANCE":"0.001","KRAKEN":"0.0026"},
      "slippageRate":"0.0005",
      "inventoryRebalanceRate":"0.001",
      "fillModel":{"version":"fill-v1","allowPartialFills":true,"queueAheadRate":"0.1","marketImpactRate":"0.0002","maxLevelParticipationRate":"0.75"},
      "validationGate":{"minNetPnl":"0","maxDrawdown":"0","minFillRate":"0.5","maxFalsePositiveRate":"0.75"}
    }
  }'
```

The worker processes the run automatically while `pnpm dev` is active. Inspect it at `GET /backtests/runs/:id` or in the dashboard at `http://localhost:3001/backtests`.

## Control and analysis endpoints

- `POST /backtests/runs/:id/pause`
- `POST /backtests/runs/:id/resume`
- `POST /backtests/runs/:id/cancel`
- `GET /backtests/compare?ids=<id-1>,<id-2>`
- `POST /backtests/sweeps` with two to fifty complete configurations
- `GET /backtests/runs/:id/export.csv`

Metrics include gross and net PnL, fees, slippage, rebalancing cost, maximum drawdown, hit rate, fill rate, capital utilization, peak capital, inventory imbalance, and false-positive rate. Every simulated fill includes the historical book id, consumed levels, arrival time, reason, and model version.

## Scenario semantics

`base` uses the supplied assumptions. `conservative` increases latency, slippage, queue position, and impact while reducing usable depth. `adverse` applies a still harsher multiplier. Parameter sweeps queue separate immutable runs so scenario sensitivity remains comparable and auditable.

## Paper-trading gate

A completed run is not automatically authorized for paper trading. The default validation decision requires positive net PnL, zero maximum drawdown, at least `0.5` fill rate, and no more than `0.75` false-positive rate. A run may override these values under `validationGate`, but the exact thresholds remain persisted with the run and visible in its eligibility decision.

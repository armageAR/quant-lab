# Observability

## Logging

- Use structured logging with Pino.
- Include correlation IDs across API and worker flows.
- Log strategy version, experiment ID, venue, and market context where useful.
- Mask secrets and sensitive account details.

## Metrics

Track metrics for:

- ingestion lag;
- feed freshness;
- worker health;
- strategy run counts and outcomes;
- backtest duration;
- order lifecycle states;
- fills and partial fills;
- risk rule triggers;
- rejected messages and malformed payloads;
- queue depth when background jobs are introduced.

## Tracing

- Preserve request or correlation IDs across services.
- Trace API requests through worker jobs where possible.
- Add enough context to reconstruct the path from opportunity detection to execution or rejection.

## Health signals

- API health;
- worker health;
- exchange connection health;
- historical dataset availability;
- database availability;
- queue availability when Redis and BullMQ are added.

## Alerts and dashboards

- alert on stale feeds;
- alert on repeated order failures;
- alert on risk-rule violations;
- alert on worker crashes or backlog growth;
- alert on execution anomalies;
- expose operational and research dashboards separately when helpful.

## Market-specific monitoring

- clock drift versus venue time;
- disconnected or stale streams;
- sequence gaps;
- spread anomalies;
- latency spikes;
- normalization failures.

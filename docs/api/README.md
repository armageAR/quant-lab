# API Notes

The API is the orchestration layer for Quant Lab. It exposes platform capabilities to the dashboard and other internal clients, but it should not own heavy ingestion, long-running research jobs, or venue-specific execution logic.

## Responsibilities

- expose read models and orchestration endpoints;
- validate requests and configuration;
- coordinate worker-driven jobs;
- provide platform status, experiments, and operational views;
- keep exchange credentials out of the frontend boundary.

## Expected endpoint groups

- health and readiness;
- configuration and capabilities;
- market and venue metadata;
- strategy and experiment orchestration;
- research and backtest results;
- paper-trading state;
- execution and audit views;
- observability and operator status.

## Validation and versioning

- request validation should use Zod or NestJS-compatible validation pipes;
- API versions should be explicit and stable;
- breaking changes should be documented and coordinated with the dashboard.

## Authentication

Authentication and authorization are future work, but the API should be designed so protected routes and role-based access can be added without reshaping the surface.

## Implemented market endpoints

- `GET /markets/comparable` returns active spot markets whose canonical instrument is available on at least two venues.
- Each result includes the venue symbol, canonical symbol, current trading constraints, and current effective maker/taker fees as decimal strings.
- Historical rule and fee versions remain internal persistence records; this endpoint intentionally returns only the latest version.
- `GET /markets/tickers?canonicalSymbol=BTC/USDT&from=...&to=...&limit=...&cursor=...` returns normalized ticker history; `marketId` scopes one venue.
- `GET /markets/trades?canonicalSymbol=BTC/USDT&from=...&to=...&limit=...&cursor=...` returns cross-venue normalized trade history. `marketId` remains available for one venue market.
- `GET /markets/candles?canonicalSymbol=BTC/USDT&interval=1m&from=...&to=...&limit=...&cursor=...` returns normalized candle history; `marketId` scopes one venue.
- Historical page sizes are required to remain between 1 and 500.

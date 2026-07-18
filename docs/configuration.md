# Configuration

## Principles

- Configuration is externalized, validated with Zod at application startup, and exposed to code through typed application-specific modules.
- Invalid or missing required configuration stops startup with a clear error.
- Secrets are never committed, logged, returned by APIs, or exposed to the dashboard bundle.
- Production behavior must not depend on implicit development defaults.
- Security-sensitive options have safe defaults. Live execution is disabled unless explicitly enabled and independently authorized.

## Environments

- `development`: local services and sandbox or read-only exchange credentials.
- `test`: isolated databases, deterministic clocks and fixtures, and no external execution.
- `production`: managed secrets, explicit endpoints, audit logging, and restrictive execution controls.

`NODE_ENV` identifies the runtime environment. Applications may load a local `.env` file for developer convenience. `.env` is ignored by Git; `.env.example` documents names and safe non-secret values. Tests should use an explicit test environment rather than a developer's `.env`.

Environment files are input mechanisms, not the configuration API. Each application owns a Zod schema, parses `process.env` once at startup, and passes an immutable typed configuration object to its modules. Shared parsing helpers may live in `packages/shared`, but API, worker, and dashboard schemas remain separate so secrets cannot cross application boundaries.

## Variable names

| Area      | Variables                                                  | Notes                                                                               |
| --------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Runtime   | `NODE_ENV`, `PORT`, `WORKER_HEALTH_PORT`                   | Service names are app-owned; operational ports are app-specific.                     |
| Database  | `DATABASE_URL`                                             | Required for applications that persist data. Never log it.                          |
| Logging   | `LOG_LEVEL`, `LOG_FORMAT`                                  | Validate against explicit enums.                                                    |
| Exchanges | `EXCHANGE_CONNECTIVITY_ENABLED`, `EXCHANGE_MARKETS`, `EXCHANGE_TIMEOUT_MS`, `EXCHANGE_RETRY_ATTEMPTS`, `EXCHANGE_CIRCUIT_FAILURES`, `EXCHANGE_CIRCUIT_RESET_MS` | Authenticated diagnostics require explicit enablement and bounded resilience settings. |
| Ingestion | `INGESTION_STREAM_DURATION_MS`, `MARKET_DATA_RETENTION_DAYS` | Bounds WebSocket validation windows and raw/normalized retention; defaults are 60 seconds and 90 days. |
| Observed detector | `OBSERVED_DETECTOR_VERSION`, `OBSERVED_MAX_BOOK_AGE_MS`, `OBSERVED_MAX_SKEW_MS`, `OBSERVED_MIN_SPREAD` | Versions and bounds raw cross-venue observations. These values never enable execution. |
| Observation loop | `OBSERVATION_LOOP_ENABLED`, `OBSERVATION_INTERVAL_MS`, `OBSERVATION_CATALOG_REFRESH_MS`, `OBSERVATION_ORDER_BOOK_DEPTH`, `OBSERVATION_MAX_BACKOFF_MS` | Runs read-only book capture and observed detection without overlapping cycles; failures use bounded backoff. |
| Binance   | `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `BINANCE_SANDBOX`, `BINANCE_INTEGRATION_ENABLED` | Credentials are paired; integration tests are explicit opt-in. |
| Kraken    | `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `KRAKEN_SANDBOX`, `KRAKEN_INTEGRATION_ENABLED` | Kraken Spot has no sandbox in CCXT, so `KRAKEN_SANDBOX` must remain `false`. |
| Execution | `LIVE_EXECUTION_ENABLED`                                   | Must default to `false`; enabling it is necessary but not sufficient to trade live. |
| Features  | `FEATURE_<NAME>_ENABLED`                                   | Flags are boolean, documented, owned, and removable.                                |

`DATABASE_URL` may point to a locally installed or remote PostgreSQL instance. The application does not provision PostgreSQL; operators own its lifecycle, access controls, backups, and availability.

Provider-specific URLs, account IDs, or subaccount names should use the provider prefix, for example `BINANCE_*` or `KRAKEN_*`. Browser-visible variables must use the framework's public prefix and must never contain secrets.

## Validation and parsing

- Parse booleans explicitly; the string `"false"` must not become truthy.
- Parse numeric settings with bounds and units in the variable name when ambiguity is possible, such as `_MS` or `_BYTES`.
- Reject unknown enum values and malformed URLs.
- Use conditional validation: credentials become required when the enabled capability needs them.
- Redact secret values from Zod errors and structured logs.
- Test valid, missing, malformed, and security-sensitive combinations.

## Feature flags

Feature flags control incomplete or operationally risky capabilities; they do not replace authorization, risk limits, or kill switches. Every flag needs an owner, purpose, safe fallback, and removal condition. Unknown flags are rejected rather than silently enabled.

`LIVE_EXECUTION_ENABLED=false` is the mandatory default in source, examples, development, and tests. Production live execution additionally requires valid restricted credentials, explicit operator authorization, risk configuration, and the execution safeguards described in the security documentation.

## Authenticated connectivity

Create separate API keys with balance/account-read permission only. Trading, order cancellation, transfers, deposits, and withdrawals must be disabled. Run the safe diagnostic from the repository root:

```bash
pnpm exchange:check
```

The command requires `EXCHANGE_CONNECTIVITY_ENABLED=true`, both venue credential pairs, and appropriate sandbox selection. It inspects permissions before reading balances and exits non-zero when dangerous permissions are detected. Its output contains counts, capabilities, clock drift, and request latency, never balance amounts or credentials.

Set `BINANCE_INTEGRATION_ENABLED=true` or `KRAKEN_INTEGRATION_ENABLED=true` only to opt that venue into `pnpm test:exchange`. These tests are skipped in CI because personal credentials are never CI inputs.

## Market catalog

`EXCHANGE_MARKETS` is the comma-separated canonical spot allowlist used by the catalog. An unset or blank value safely falls back to `BTC/USDT,BTC/USD`; unsupported venue symbols are ignored rather than persisted as partially normalized instruments.

Apply migrations and run a one-shot authenticated metadata refresh from the repository root:

```bash
pnpm db:deploy
pnpm catalog:refresh
```

The command requires connectivity plus at least one enabled integration. It reads public market definitions and authenticated effective fees, versions changes to rules, fees, and capabilities, and never calls an order API.

Market data commands are also read-only at the exchange boundary:

```bash
pnpm market:ingest  # REST ticker/trade/candle backfill plus clock drift
pnpm market:stream  # concurrent Binance/Kraken public WebSockets
pnpm market:retain  # remove raw and normalized events older than retention
```

With exchange connectivity and venue integrations enabled, the regular worker
automatically refreshes the catalog, captures configured order books, and runs
the observed detector. `pnpm dev` therefore keeps the opportunities dashboard
updated; the one-shot commands remain available for diagnostics and recovery.

## Unsafe defaults

Do not default to live endpoints, live execution, permissive CORS, disabled authentication, unbounded retries, unlimited order size, or placeholder secrets. When a safe value cannot be inferred, require configuration and fail startup.

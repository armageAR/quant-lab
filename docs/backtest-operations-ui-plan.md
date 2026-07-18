# Backtest operations UI plan

**Status:** completed on 2026-07-18.

The delivered `/backtests` workspace covers dataset preparation, experiments,
single runs, three-scenario sweeps, queue controls, polling, result inspection,
comparison, and CSV export through a same-origin BFF. Live execution and AI
selection remain out of scope.

## Purpose

Deliver a complete web workflow for creating, operating, comparing, and exporting deterministic backtests without requiring `curl`, direct database access, or terminal commands. This is Sprint 4.4, after the simulation engine and before paper trading.

The UI remains research-only. It cannot place exchange orders, enable paper trading automatically, or change `LIVE_EXECUTION_ENABLED`. AI-assisted experiment selection is explicitly out of scope.

## Product workflow

The operator must be able to complete this flow from `/backtests`:

1. Inspect available historical datasets and their quality status.
2. Create or select an experiment with a documented hypothesis.
3. Configure a single run or bounded parameter sweep.
4. Review the complete immutable request before queueing.
5. Queue the work and monitor worker progress.
6. Pause, resume, or cancel eligible runs.
7. Inspect metrics, assumptions, provenance, evidence, and validation gate.
8. Select comparable runs and review differences.
9. Export a run as CSV.

## Guardrails

- All monetary values, rates, sizes, and fees remain decimal strings from form input through API validation.
- The dashboard never calculates authoritative PnL, fills, eligibility, or accounting values.
- Dataset, configuration, seed, commit, and model versions are visible before submission and immutable afterward.
- Mutations require an explicit confirmation step and provide idempotent feedback for repeated clicks.
- Parameter sweeps are limited to 2-50 complete configurations, matching the API boundary.
- UI controls cannot queue paper or live execution.
- Dates are displayed in `America/Argentina/Buenos_Aires` (GMT-3), while API payloads remain UTC.
- No unsafe defaults: missing fee rates, dataset provenance, or required model versions block submission.

## Delivery sequence

### Task 4.4.1: Complete read APIs and contracts

Backend:

- Add paginated `GET /datasets` with filters for market, UTC range, pinned state, validation state, and stable creation ordering.
- Return dataset summary fields needed by the selector: ID, markets, range, event count, checksum, pinned state, quality status, and creation time.
- Define exported request/response schemas for experiments, runs, controls, comparison, sweeps, and datasets instead of duplicating anonymous dashboard interfaces.
- Add a non-secret build metadata source for the current commit SHA; fail run creation when provenance is unavailable rather than storing an empty commit.
- Preserve bounded query limits and deterministic ordering.

Tests:

- Controller validation for pagination and filters.
- PostgreSQL integration coverage for empty, filtered, and paginated dataset lists.
- Contract tests proving decimal values remain strings.

Acceptance:

- The dashboard can discover every selectable dataset without knowing an ID in advance.
- Dataset ordering and pagination are stable under concurrent ingestion.
- No secret or credential is exposed by the new responses.

### Task 4.4.2: Add the dashboard BFF and mutation safety

Frontend infrastructure:

- Add same-origin Next.js route handlers or server actions for dataset, experiment, and backtest operations.
- Keep `API_INTERNAL_URL` server-only; browser code must not depend on API CORS or internal hostnames.
- Normalize upstream failures into structured UI errors with correlation IDs.
- Add request timeouts, disabled submit states, duplicate-click protection, and retry only for safe reads.
- Add a reusable polling controller with visibility-aware intervals and cleanup on navigation.

Tests:

- BFF success, validation error, timeout, and unavailable-API cases.
- Verify mutations are not automatically retried.
- Verify internal URLs and secrets are absent from browser bundles and responses.

Acceptance:

- Every workflow works from the dashboard origin at `http://localhost:3001`.
- API downtime produces an actionable message rather than an empty successful state.

### Task 4.4.3: Dataset and experiment workspace

UI:

- Add tabs or compact sections for `Datasets`, `Experiments`, `Runs`, and `Compare` within `/backtests`.
- Build a searchable, sortable, paginated dataset selector.
- Show market coverage, UTC/GMT-3 range, event count, checksum prefix, pin state, and validation warnings.
- Add dataset creation for selected comparable markets and a bounded UTC interval.
- Add validate and pin actions with confirmation and visible results.
- Add experiment creation with required name and hypothesis.
- Allow filtering runs by experiment and selecting the active experiment.

Acceptance:

- A new operator can create/select a valid pinned dataset and experiment without terminal commands.
- Invalid or unpinned datasets are visibly distinguished and require explicit resolution before queueing.

### Task 4.4.4: Run configuration form

UI:

- Implement scenario selection: `base`, `conservative`, and `adverse`.
- Configure trade size, order type, submission delay, cancellation timeout, venue fee rates, slippage, rebalancing, partial fills, queue-ahead rate, market impact, maximum level participation, seed, and validation-gate thresholds.
- Display field units and examples; validate decimals lexically without converting them to JavaScript `number`.
- Load safe versioned presets while keeping every resulting value visible and editable.
- Show an immutable JSON review modal before queueing.
- Display estimated run count for sweeps before confirmation.

Validation:

- Use Zod schemas shared with or generated from the API contract.
- Reject negative values, invalid decimal syntax, missing venue fees, unsupported scenarios, incomplete model versions, and sweep cardinality outside 2-50.
- Preserve the exact submitted configuration in the confirmation and resulting run detail.

Acceptance:

- A valid run can be created entirely from the UI.
- Invalid configuration cannot reach the API.
- The operator sees dataset, experiment, commit, seed, versions, and assumptions together before submission.

### Task 4.4.5: Run queue and lifecycle controls

UI:

- Replace the current static cards with a sortable/filterable run table and expandable detail drawer or modal.
- Show status, progress, experiment, dataset, scenario, creation/start/end times, and current error.
- Poll queued/running/paused runs without discarding filters, selections, or expanded details.
- Expose pause only for running runs, resume only for paused runs, and cancel only for active runs.
- Require confirmation for cancel and show the server-confirmed resulting state.
- Add manual refresh and reset controls consistent with the opportunities page.

Acceptance:

- State changes become visible without a full browser reload.
- Controls cannot issue invalid transitions from the UI.
- Refresh and polling preserve local operator context.

### Task 4.4.6: Results, comparison, and exports

UI:

- Present gross-to-net attribution, fees, slippage, rebalancing, net PnL, drawdown, hit rate, fill rate, capital utilization, peak capital, inventory imbalance, and false-positive rate.
- Clearly separate authoritative engine metrics from explanatory labels.
- Show eligibility thresholds, pass/fail per threshold, reasons, and scenario.
- Show provenance and sampled fill evidence without rendering unbounded JSON into the page.
- Allow selection of 2-10 compatible runs and call `GET /backtests/compare`.
- Highlight configuration and metric differences; warn when datasets differ.
- Add CSV download using the existing export endpoint.

Acceptance:

- Runs can be compared without losing dataset/configuration provenance.
- Positive PnL is never presented without costs, drawdown, sample size, and eligibility context.
- Exported CSV corresponds to the selected run.

### Task 4.4.7: UX, accessibility, and operational verification

- Keep the existing compact top navigation and modal information pattern.
- Make all forms, tables, dialogs, tabs, status changes, and error messages keyboard accessible.
- Add responsive layouts for desktop and mobile without hiding critical provenance or risk information.
- Add loading, empty, partial-data, stale-data, API-offline, worker-offline, failed-run, and no-compatible-comparison states.
- Add accessible labels and live regions for submission and progress changes.
- Verify GMT-3 presentation and UTC request serialization.
- Update `docs/backtesting.md`, API notes, changelog, and dashboard help content.

Tests and quality gate:

- Unit tests for schemas, decimal handling, presets, comparison compatibility, and state-transition control rules.
- Component tests for creation, confirmation, refresh/poll preservation, pause/resume/cancel, and errors.
- API and PostgreSQL integration tests for dataset listing and full create-to-complete lifecycle.
- One browser-level happy path: create/select dataset, create experiment, queue run, observe completion, compare, and export.
- Run `pnpm format:check`, `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and relevant integration/process tests with development servers stopped during production builds.

## Definition of Done

Sprint 4.4 is complete only when:

- the complete single-run workflow requires no terminal command;
- dataset discovery, validation, and experiment creation are available from the UI;
- lifecycle controls reflect and enforce server state;
- filters and selections survive refresh and polling;
- every authoritative result remains traceable to immutable provenance;
- decimal inputs are never passed through uncontrolled floating point;
- error, offline, empty, and mobile states are tested;
- documentation describes both the UI workflow and API fallback;
- live execution remains disabled and unreachable;
- the supported repository quality gate passes.

## Explicitly deferred

- AI-generated hypotheses, dataset ranking, or autonomous run creation.
- Automatic promotion to paper trading.
- Paper balances, positions, risk limits, and simulated live orders (Phase 5).
- Live order submission or exchange execution permissions (Phase 7).

# Paper trading

Phase 5 runs the spot arbitrage workflow against persisted live-feed evidence without submitting exchange orders. The implementation has no dependency on an exchange write API and cannot enable `LIVE_EXECUTION_ENABLED`.

## Start locally

Configure `PAPER_TRADING_ENABLED=true` only for the worker process and optionally `PAPER_TRADING_POLL_INTERVAL_MS=2000`. Start the platform with `pnpm dev`, then open `http://localhost:3001/paper-trading`.

1. Create a session with an explicit commit, strategy version, starting inventory and risk limits.
2. Start the session. The worker consumes new executable opportunities idempotently.
3. Monitor independent Binance/Kraken balances, simulated orders, risk blocks and alerts.
4. Pause or stop normally, or persist the emergency stop. A stopped session cannot be restarted.
5. Start the predefined 72-hour, 100-filled-order campaign and evaluate it without changing its minimums.

All amounts are exact decimal strings. A simulated fill moves balances through paired ledger entries. Fill keys, opportunity leg keys and order intent keys are unique, so restart recovery does not duplicate fills.

## Risk boundary

Every intent is checked immediately before simulation for maximum order notional, venue exposure, daily loss, feed age and inventory imbalance. Blocks create a rejected order and an operator-visible alert with explicit reasons. Insufficient inventory also rejects simulation.

Paper lifecycle controls are `start`, `pause`, `stop`, and `emergency-stop`. None of these controls maps to exchange order submission.

## Campaign decision

The campaign report records duration, sample count, feed gaps, risk blocks, expected versus simulated profit, missed legs and unresolved risks. Before 72 hours and 100 completed fills, the only decision is `no_go_insufficient_evidence`. Satisfying the minimums yields `go_to_review`, never automatic promotion.

The initial unresolved-risk register is:

- partial-leg exposure during asymmetric simulated fills;
- inventory drift between venues and rebalancing cost;
- stale or discontinuous books during exchange degradation;
- divergence between detector expectation and paper fill outcome;
- operational recovery after process or database interruption.

## Incident procedure

1. Activate **Emergency stop** in the dashboard.
2. Confirm the session is `emergency_stopped` through `GET /paper-trading/sessions/:id`.
3. Preserve alerts, orders, fills and ledger entries; do not delete evidence.
4. Reconcile each ledger `groupId` to zero and compare account balances with starting inventory plus entries.
5. Record the cause and recovery evidence in the unresolved-risk register.
6. Create a new versioned session for any resumed campaign. Emergency-stopped sessions are not restarted.

## API fallback

- `GET|POST /paper-trading/sessions`
- `GET /paper-trading/sessions/:id`
- `POST /paper-trading/sessions/:id/start|pause|stop|emergency-stop`
- `POST /paper-trading/sessions/:id/opportunities/:opportunityId`
- `POST /paper-trading/sessions/:id/campaigns`
- `GET /paper-trading/campaigns/:id/report?finalize=true`

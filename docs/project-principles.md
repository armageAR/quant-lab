# Project Principles

## Software architecture

- Prefer explicit interfaces over implicit coupling.
- Keep module ownership clear and narrow.
- Use dependency inversion across strategy, execution, and data boundaries.
- Keep exchange-specific code behind adapters.
- Keep strategy logic deterministic and testable.
- Prefer small, focused modules over broad shared abstractions.
- Validate configuration at startup rather than discovering invalid state at runtime.
- Avoid hidden global state.
- Build observability into the design, not as an afterthought.

## Quantitative research

- Make experiments reproducible.
- Version experiment parameters, datasets, and strategy code.
- Store the Git commit SHA or equivalent source version for every experiment.
- Model realistic fees, slippage, and latency.
- Avoid look-ahead bias.
- Avoid survivorship bias.
- Never assume fills at observed prices without a fill model.
- Separate observed opportunity from executable opportunity.
- Evaluate net returns, not only gross returns.
- Check data quality and timestamp consistency before trusting results.

## Risk and execution

- Backtesting comes before paper trading.
- Paper trading comes before live execution.
- Live execution is disabled by default.
- Require explicit approval before the first live run.
- Enforce maximum position size.
- Enforce maximum loss and exposure limits.
- Use a kill switch for live execution.
- Keep API credentials secret and least-privilege.
- Never expose exchange credentials to the frontend.
- Maintain auditability and reconciliation for every execution path.

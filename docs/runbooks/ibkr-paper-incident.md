# IBKR paper incident runbook

1. Set `IBKR_PAPER_EXECUTION_ENABLED=false` and stop the affected campaign.
2. Do not resubmit intents with an uncertain response.
3. Record Gateway time, disconnects, local intent IDs, IBKR order IDs, fills,
   positions, cash, and account identity without copying credentials.
4. Reconnect to the paper account and reconcile open/completed orders before any
   cancellation or retry.
5. Treat unknown broker orders or missing local orders as a stop condition.
6. Resume only with a new bounded campaign after discrepancies are explained.

This procedure never enables or recommends live execution.

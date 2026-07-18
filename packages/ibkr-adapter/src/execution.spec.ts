import { expect, it, vi } from 'vitest';
import { IbkrPaperExecutionProvider, type StoredPaperOrder } from './execution';
import { loadIbkrConfig } from './config';

function setup() {
  const rows = new Map<string, StoredPaperOrder>();
  const store = {
    find: (id: string) => Promise.resolve(rows.get(id) ?? null),
    save: (order: StoredPaperOrder) => {
      rows.set(order.intentId, order);
      return Promise.resolve();
    },
    listActive: () => Promise.resolve([...rows.values()]),
  };
  const broker = {
    managedAccounts: () => Promise.resolve(['DU123']),
    place: vi.fn(() => Promise.resolve({ brokerOrderId: 7 })),
    openOrders: () =>
      Promise.resolve(
        [...rows.values()]
          .filter((x) => x.brokerOrderId)
          .map((x) => ({
            intentId: x.intentId,
            brokerOrderId: x.brokerOrderId!,
          })),
      ),
    cancel: () => Promise.resolve(),
  };
  const config = loadIbkrConfig({
    IBKR_CONNECTIVITY_ENABLED: 'true',
    IBKR_PAPER_ENABLED: 'true',
    IBKR_PAPER_EXECUTION_ENABLED: 'true',
    IBKR_PORT: '4002',
    IBKR_CLIENT_ID: '9',
    IBKR_ACCOUNT_ID: 'DU123',
    IBKR_CONTRACT_IDS: '756733',
  });
  return {
    provider: new IbkrPaperExecutionProvider(config, broker, store),
    broker,
    rows,
  };
}

it('persists before routing and deduplicates restart submissions', async () => {
  const { provider, broker } = setup();
  const intent = {
    runId: 'r1',
    conId: '756733',
    side: 'buy' as const,
    quantity: '1',
    limitPrice: '600',
  };
  const first = await provider.submit(intent);
  const second = await provider.submit(intent);
  expect(first).toEqual(second);
  expect(broker.place).toHaveBeenCalledTimes(1);
  await expect(provider.reconcile()).resolves.toEqual({
    missingAtBroker: [],
    unknownAtBroker: [],
  });
});

it('never retries an uncertain submission blindly', async () => {
  const { provider, broker } = setup();
  broker.place.mockRejectedValueOnce(new Error('disconnect'));
  const intent = {
    runId: 'r1',
    conId: '756733',
    side: 'buy' as const,
    quantity: '1',
    limitPrice: '600',
  };
  await expect(provider.submit(intent)).rejects.toThrow('disconnect');
  await expect(provider.submit(intent)).rejects.toThrow(
    'requires_reconciliation',
  );
  expect(broker.place).toHaveBeenCalledTimes(1);
});

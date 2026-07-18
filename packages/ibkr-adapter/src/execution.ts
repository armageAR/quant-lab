import { createHash } from 'node:crypto';
import type { IbkrConfig } from './config';

export interface IbkrPaperIntent {
  runId: string;
  conId: string;
  side: 'buy' | 'sell';
  quantity: string;
  limitPrice: string;
}
export interface StoredPaperOrder extends IbkrPaperIntent {
  intentId: string;
  status: 'pending' | 'submitted' | 'uncertain' | 'cancelled';
  brokerOrderId?: number;
}
export interface IbkrPaperOrderStore {
  find(intentId: string): Promise<StoredPaperOrder | null>;
  save(order: StoredPaperOrder): Promise<void>;
  listActive(): Promise<readonly StoredPaperOrder[]>;
}
export interface IbkrPaperBrokerPort {
  managedAccounts(): Promise<readonly string[]>;
  place(order: StoredPaperOrder): Promise<{ brokerOrderId: number }>;
  openOrders(): Promise<readonly { intentId: string; brokerOrderId: number }[]>;
  cancel(brokerOrderId: number): Promise<void>;
}

export class IbkrPaperExecutionProvider {
  constructor(
    private readonly config: IbkrConfig,
    private readonly broker: IbkrPaperBrokerPort,
    private readonly store: IbkrPaperOrderStore,
  ) {}

  async submit(intent: IbkrPaperIntent): Promise<StoredPaperOrder> {
    this.assertEnabled();
    const accounts = await this.broker.managedAccounts();
    if (!accounts.includes(this.config.IBKR_ACCOUNT_ID!))
      throw new Error('configured IBKR paper account is not managed');
    if (!this.config.IBKR_CONTRACT_IDS.includes(Number(intent.conId)))
      throw new Error('instrument_not_allowlisted');
    const intentId = deterministicIntentId(intent);
    const existing = await this.store.find(intentId);
    if (existing) {
      if (existing.status === 'uncertain')
        throw new Error('uncertain_submission_requires_reconciliation');
      return existing;
    }
    const order: StoredPaperOrder = { ...intent, intentId, status: 'pending' };
    await this.store.save(order);
    try {
      const result = await this.broker.place(order);
      const submitted = {
        ...order,
        status: 'submitted' as const,
        brokerOrderId: result.brokerOrderId,
      };
      await this.store.save(submitted);
      return submitted;
    } catch (error) {
      await this.store.save({ ...order, status: 'uncertain' });
      throw error;
    }
  }

  async reconcile(): Promise<{
    missingAtBroker: string[];
    unknownAtBroker: string[];
  }> {
    this.assertEnabled();
    const [local, broker] = await Promise.all([
      this.store.listActive(),
      this.broker.openOrders(),
    ]);
    const localIds = new Set(local.map((item) => item.intentId));
    const brokerIds = new Set(broker.map((item) => item.intentId));
    return {
      missingAtBroker: local
        .filter((item) => !brokerIds.has(item.intentId))
        .map((item) => item.intentId),
      unknownAtBroker: broker
        .filter((item) => !localIds.has(item.intentId))
        .map((item) => item.intentId),
    };
  }

  private assertEnabled(): void {
    if (
      !this.config.IBKR_CONNECTIVITY_ENABLED ||
      !this.config.IBKR_PAPER_ENABLED ||
      !this.config.IBKR_PAPER_EXECUTION_ENABLED
    )
      throw new Error('IBKR paper execution is disabled');
  }
}

export function deterministicIntentId(intent: IbkrPaperIntent): string {
  return createHash('sha256')
    .update(
      [
        intent.runId,
        intent.conId,
        intent.side,
        intent.quantity,
        intent.limitPrice,
      ].join('|'),
    )
    .digest('hex');
}

import { IBApiNext, SecType, type ContractDetails } from '@stoqey/ib';

import type { IbkrConfig } from './config';

export interface IbkrGatewayClient {
  connect(): Promise<void>;
  currentTime(): Promise<Date>;
  managedAccounts(): Promise<readonly string[]>;
  contractDetails(conId: number): Promise<readonly ContractDetails[]>;
  disconnect(): Promise<void>;
}

export class TwsIbkrGatewayClient implements IbkrGatewayClient {
  readonly #api: IBApiNext;

  constructor(private readonly config: IbkrConfig) {
    this.#api = new IBApiNext({
      host: config.IBKR_HOST,
      port: config.IBKR_PORT,
      reconnectInterval: config.IBKR_RECONNECT_MS,
      maxReqPerSec: config.IBKR_MAX_REQUESTS_PER_SECOND,
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    });
  }

  async connect(): Promise<void> {
    this.#api.connect(this.config.IBKR_CLIENT_ID);
    await withTimeout(this.#api.getCurrentTime(), this.config.IBKR_TIMEOUT_MS);
  }

  async currentTime(): Promise<Date> {
    const seconds = await withTimeout(
      this.#api.getCurrentTime(),
      this.config.IBKR_TIMEOUT_MS,
    );
    return new Date(seconds * 1000);
  }

  managedAccounts(): Promise<string[]> {
    return withTimeout(
      this.#api.getManagedAccounts(),
      this.config.IBKR_TIMEOUT_MS,
    );
  }

  contractDetails(conId: number): Promise<ContractDetails[]> {
    return withTimeout(
      this.#api.getContractDetails({
        conId,
        exchange: 'SMART',
        secType: SecType.STK,
        currency: 'USD',
      }),
      this.config.IBKR_TIMEOUT_MS,
    );
  }

  disconnect(): Promise<void> {
    this.#api.disconnect();
    return Promise.resolve();
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('IBKR request timed out')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

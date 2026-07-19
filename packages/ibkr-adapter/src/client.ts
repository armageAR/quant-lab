import {
  BarSizeSetting,
  ConnectionState,
  IBApiNext,
  SecType,
  WhatToShow,
  type Bar,
  type ContractDetails,
} from '@stoqey/ib';

import type { IbkrConfig } from './config';

export interface IbkrGatewayClient {
  connect(): Promise<void>;
  currentTime(): Promise<Date>;
  managedAccounts(): Promise<readonly string[]>;
  contractDetails(conId: number): Promise<readonly ContractDetails[]>;
  historicalBars(conId: number, duration: string): Promise<readonly Bar[]>;
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
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        subscription.unsubscribe();
        reject(new Error('IBKR connection handshake timed out'));
      }, this.config.IBKR_TIMEOUT_MS);
      const subscription = this.#api.connectionState.subscribe((state) => {
        if (settled || state !== ConnectionState.Connected) return;
        settled = true;
        clearTimeout(timer);
        subscription.unsubscribe();
        resolve();
      });
      this.#api.connect(this.config.IBKR_CLIENT_ID);
    });
    // IB marks the socket connected before nextValidId releases its decoder.
    // Requests sent in that short window are silently dropped by TWS.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  async currentTime(): Promise<Date> {
    const seconds = await withTimeout(
      this.#api.getCurrentTime(),
      this.config.IBKR_TIMEOUT_MS,
      'current time',
    );
    return new Date(seconds * 1000);
  }

  managedAccounts(): Promise<string[]> {
    return withTimeout(
      this.#api.getManagedAccounts(),
      this.config.IBKR_TIMEOUT_MS,
      'managed accounts',
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
      `contract details for ${String(conId)}`,
    );
  }

  historicalBars(conId: number, duration: string): Promise<Bar[]> {
    return withTimeout(
      this.#api.getHistoricalData(
        { conId, exchange: 'SMART', secType: SecType.STK, currency: 'USD' },
        undefined,
        duration,
        BarSizeSetting.MINUTES_ONE,
        WhatToShow.TRADES,
        this.config.IBKR_REGULAR_TRADING_HOURS_ONLY,
        2,
      ),
      this.config.IBKR_TIMEOUT_MS,
      `historical bars for ${String(conId)}`,
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
  operation: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`IBKR ${operation} request timed out`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

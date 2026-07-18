import { SecType, type ContractDetails } from '@stoqey/ib';

import type { IbkrGatewayClient } from './client';
import type { IbkrConfig } from './config';
import type { IbkrContractRecord, IbkrDiagnostic } from './model';

export class IbkrReadOnlyAdapter {
  constructor(
    private readonly config: IbkrConfig,
    private readonly client: IbkrGatewayClient,
  ) {}

  async verify(): Promise<IbkrDiagnostic> {
    if (
      !this.config.IBKR_CONNECTIVITY_ENABLED ||
      !this.config.IBKR_PAPER_ENABLED
    )
      throw new Error('IBKR paper connectivity is disabled');
    const started = Date.now();
    await this.client.connect();
    try {
      const [serverTime, accounts] = await Promise.all([
        this.client.currentTime(),
        this.client.managedAccounts(),
      ]);
      if (!accounts.includes(this.config.IBKR_ACCOUNT_ID!))
        throw new Error(
          'configured IBKR paper account is not managed by this session',
        );
      const contracts = await Promise.all(
        this.config.IBKR_CONTRACT_IDS.map((conId) =>
          this.resolveContract(conId),
        ),
      );
      return {
        status: 'ok',
        environment: 'paper',
        serverTime: serverTime.toISOString(),
        accountMatched: true,
        managedAccountCount: accounts.length,
        contracts,
        latencyMs: Date.now() - started,
      };
    } finally {
      await this.client.disconnect();
    }
  }

  async resolveContract(conId: number): Promise<IbkrContractRecord> {
    const matches = await this.client.contractDetails(conId);
    const eligible = matches.filter(
      (item) =>
        item.contract.conId === conId &&
        item.contract.secType === SecType.STK &&
        item.contract.currency === 'USD',
    );
    if (eligible.length !== 1)
      throw new Error(
        `IBKR conId ${conId} did not resolve uniquely to a USD stock/ETF`,
      );
    return normalize(eligible[0]!);
  }
}

function normalize(details: ContractDetails): IbkrContractRecord {
  const contract = details.contract;
  const required = {
    conId: contract.conId,
    symbol: contract.symbol,
    exchange: contract.exchange,
    primaryExchange: contract.primaryExch,
    localSymbol: contract.localSymbol,
    minimumTick: details.minTick,
    timeZoneId: details.timeZoneId,
    tradingHours: details.tradingHours,
    liquidHours: details.liquidHours,
    longName: details.longName,
  };
  if (
    Object.values(required).some((value) => value === undefined || value === '')
  )
    throw new Error(
      `IBKR contract ${String(contract.conId)} has incomplete metadata`,
    );
  return {
    conId: String(required.conId),
    symbol: String(required.symbol),
    securityType: 'STK',
    currency: 'USD',
    exchange: String(required.exchange),
    primaryExchange: String(required.primaryExchange),
    localSymbol: String(required.localSymbol),
    minimumTick: String(required.minimumTick),
    timeZoneId: String(required.timeZoneId),
    tradingHours: String(required.tradingHours),
    liquidHours: String(required.liquidHours),
    longName: String(required.longName),
  };
}

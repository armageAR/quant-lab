export interface IbkrContractRecord {
  conId: string;
  symbol: string;
  securityType: 'STK';
  currency: 'USD';
  exchange: string;
  primaryExchange: string;
  localSymbol: string;
  minimumTick: string;
  timeZoneId: string;
  tradingHours: string;
  liquidHours: string;
  longName: string;
}

export interface IbkrDiagnostic {
  status: 'ok';
  environment: 'paper';
  serverTime: string;
  accountMatched: true;
  managedAccountCount: number;
  contracts: readonly IbkrContractRecord[];
  latencyMs: number;
}

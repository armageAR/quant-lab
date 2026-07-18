import type { DatabaseClient } from '@quant-lab/database';
import {
  IbkrReadOnlyAdapter,
  TwsIbkrGatewayClient,
  loadIbkrConfig,
} from '@quant-lab/ibkr-adapter';
import { createHash } from 'node:crypto';

export interface IbkrContractView {
  id: string;
  conId: string;
  symbol: string;
  securityType: string;
  currency: string;
  exchange: string;
  primaryExchange: string;
  localSymbol: string;
  minimumTick: string;
  timeZoneId: string;
  tradingHours: string;
  liquidHours: string;
  longName: string;
  observedAt: string;
}

export interface IbkrRefreshView {
  status: 'ok';
  environment: 'paper';
  serverTime: string;
  contractCount: number;
  latencyMs: number;
}

export class IbkrService {
  constructor(private readonly database: DatabaseClient) {}

  async list(): Promise<IbkrContractView[]> {
    const rows = await this.database.ibkrContractVersion.findMany({
      orderBy: [{ conId: 'asc' }, { observedAt: 'desc' }],
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      conId: row.conId,
      symbol: row.symbol,
      securityType: row.securityType,
      currency: row.currency,
      exchange: row.exchange,
      primaryExchange: row.primaryExchange,
      localSymbol: row.localSymbol,
      minimumTick: row.minimumTick.toString(),
      timeZoneId: row.timeZoneId,
      tradingHours: row.tradingHours,
      liquidHours: row.liquidHours,
      longName: row.longName,
      observedAt: row.observedAt.toISOString(),
    }));
  }

  async refresh(): Promise<IbkrRefreshView> {
    const config = loadIbkrConfig(process.env);
    const report = await new IbkrReadOnlyAdapter(
      config,
      new TwsIbkrGatewayClient(config),
    ).verify();
    for (const contract of report.contracts) {
      const fingerprint = createHash('sha256')
        .update(JSON.stringify(contract))
        .digest('hex');
      await this.database.ibkrContractVersion.upsert({
        where: { fingerprint },
        create: { ...contract, fingerprint },
        update: {},
      });
    }
    return {
      status: report.status,
      environment: report.environment,
      serverTime: report.serverTime,
      contractCount: report.contracts.length,
      latencyMs: report.latencyMs,
    };
  }
}

import type { DatabaseClient } from '@quant-lab/database';
import {
  IbkrReadOnlyAdapter,
  TwsIbkrGatewayClient,
  loadIbkrConfig,
  normalizeHistoricalBar,
} from '@quant-lab/ibkr-adapter';
import { createHash, randomUUID } from 'node:crypto';

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
  environment: 'paper' | 'live-readonly';
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

  async refreshHistory(): Promise<{ requestId: string; stored: number }> {
    const config = loadIbkrConfig(process.env);
    if (!config.IBKR_CONNECTIVITY_ENABLED)
      throw new Error('IBKR connectivity is disabled');
    const client = new TwsIbkrGatewayClient(config);
    const requestId = randomUUID();
    let stored = 0;
    await client.connect();
    try {
      for (const conId of config.IBKR_CONTRACT_IDS) {
        const started = Date.now();
        const receivedAt = new Date();
        const bars = await client.historicalBars(conId, '1 D');
        const latencyMs = Date.now() - started;
        for (const raw of bars) {
          const bar = normalizeHistoricalBar(conId, raw, receivedAt);
          await this.database.ibkrHistoricalBar.upsert({
            where: {
              conId_eventTime_sourcePrecision: {
                conId: bar.conId,
                eventTime: new Date(bar.eventTime),
                sourcePrecision: bar.sourcePrecision,
              },
            },
            create: {
              ...bar,
              eventTime: new Date(bar.eventTime),
              receivedAt: new Date(bar.receivedAt),
              processedAt: new Date(bar.processedAt),
              requestId,
              useRth: config.IBKR_REGULAR_TRADING_HOURS_ONLY,
              latencyMs,
            },
            update: {},
          });
          stored += 1;
        }
      }
    } finally {
      await client.disconnect();
    }
    return { requestId, stored };
  }
}

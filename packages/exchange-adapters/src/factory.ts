import { binance, kraken } from 'ccxt';

import type { ReadOnlyCcxtClient } from './client';
import type { VenueAdapterConfig } from './config';

type PermissionAwareExchange = {
  id: string;
  has: Record<string, boolean | string | undefined>;
  number: (value: string) => string;
  loadMarkets(reload?: boolean): Promise<unknown>;
  fetchTime(): Promise<number>;
  fetchBalance(): Promise<unknown>;
  fetchTradingFees(): Promise<unknown>;
  fetchTicker(symbol: string): Promise<unknown>;
  fetchTrades(symbol: string, since?: number, limit?: number): Promise<unknown>;
  fetchOHLCV(
    symbol: string,
    timeframe: string,
    since?: number,
    limit?: number,
  ): Promise<unknown>;
  setSandboxMode(enabled: boolean): void;
  close(): Promise<void>;
  sapiGetAccountApiRestrictions?: () => Promise<unknown>;
  privatePostGetApiKeyInfo?: () => Promise<unknown>;
};

export function createCcxtReadOnlyClient(
  config: VenueAdapterConfig,
): ReadOnlyCcxtClient {
  const ExchangeClass = config.venue === 'binance' ? binance : kraken;
  const exchange = new ExchangeClass({
    apiKey: config.apiKey,
    secret: config.secret,
    enableRateLimit: true,
    timeout: config.timeoutMilliseconds,
  }) as unknown as PermissionAwareExchange;
  exchange.number = String;
  if (config.sandbox) exchange.setSandboxMode(true);

  const inspectPermissions = async (): Promise<unknown> => {
    if (config.venue === 'binance' && exchange.sapiGetAccountApiRestrictions) {
      return exchange.sapiGetAccountApiRestrictions();
    }
    if (config.venue === 'kraken' && exchange.privatePostGetApiKeyInfo) {
      return exchange.privatePostGetApiKeyInfo();
    }
    throw new Error(`${config.venue} permission inspection is unavailable`);
  };

  return {
    id: exchange.id,
    has: exchange.has,
    loadMarkets: (reload) => exchange.loadMarkets(reload) as never,
    fetchTime: () => exchange.fetchTime(),
    fetchBalance: () => exchange.fetchBalance() as never,
    fetchTradingFees: () => exchange.fetchTradingFees() as never,
    fetchTicker: (symbol) => exchange.fetchTicker(symbol) as never,
    fetchTrades: (symbol, since, limit) =>
      exchange.fetchTrades(symbol, since, limit) as never,
    fetchOHLCV: (symbol, timeframe, since, limit) =>
      exchange.fetchOHLCV(symbol, timeframe, since, limit) as never,
    inspectPermissions,
    close: () => exchange.close(),
  };
}

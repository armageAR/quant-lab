import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SourceTimestamp } from '@quant-lab/core';
import type { ProviderError } from '@quant-lab/market-data';
import { describe, expect, it } from 'vitest';

import { CcxtReadOnlyExchangeAdapter } from './adapter';
import type { ReadOnlyCcxtClient } from './client';
import type { VenueAdapterConfig } from './config';

const config: VenueAdapterConfig = {
  venue: 'binance',
  apiKey: 'not-a-real-key',
  secret: 'not-a-real-secret',
  sandbox: true,
  timeoutMilliseconds: 1_000,
  retryAttempts: 1,
  circuitFailures: 2,
  circuitResetMilliseconds: 1_000,
};

function fakeClient(
  permissions: unknown = {
    enableReading: true,
    enableSpotAndMarginTrading: false,
    enableWithdrawals: false,
    enableInternalTransfer: false,
  },
): ReadOnlyCcxtClient {
  return {
    id: 'binance',
    has: { fetchBalance: true, fetchTradingFees: true },
    loadMarkets: () =>
      Promise.resolve({
        'BTC/USDT': {
          id: 'BTCUSDT',
          symbol: 'BTC/USDT',
          base: 'BTC',
          quote: 'USDT',
          spot: true,
          active: true,
          maker: '0.001',
          taker: '0.001',
          precision: { price: '0.01', amount: '0.00001' },
          limits: { amount: { min: '0.00001' }, cost: { min: '5' } },
        },
      }),
    fetchTime: () => Promise.resolve('1700000000000'),
    fetchBalance: () =>
      Promise.resolve({
        free: { BTC: '0.1' },
        used: { BTC: '0.2' },
        total: { BTC: '0.3' },
      }),
    fetchTradingFees: () =>
      Promise.resolve({
        'BTC/USDT': { symbol: 'BTC/USDT', maker: '0.0009', taker: '0.001' },
      }),
    fetchTicker: () =>
      Promise.resolve({
        timestamp: 1_700_000_000_000,
        bid: '100',
        ask: '101',
        last: '100.5',
      }),
    fetchTrades: () => Promise.resolve([]),
    fetchOHLCV: () => Promise.resolve([]),
    fetchOrderBook: () =>
      Promise.resolve({
        timestamp: 1_700_000_000_000,
        nonce: '42',
        bids: [['100', '2']],
        asks: [['101', '3']],
      }),
    inspectPermissions: () => Promise.resolve(permissions),
    close: () => Promise.resolve(),
  };
}

function adapter(client = fakeClient()): CcxtReadOnlyExchangeAdapter {
  let monotonic = 0;
  return new CcxtReadOnlyExchangeAdapter(config, {
    client,
    wallClock: () => SourceTimestamp.fromEpochMilliseconds('1700000000000'),
    monotonicMilliseconds: () => (monotonic += 10),
  });
}

describe('CCXT read-only exchange adapter', () => {
  it('normalizes markets, exact rules, balances, fees, and clock drift', async () => {
    const subject = adapter();
    const report = await subject.verifyConnectivity(['BTC/USDT', 'ETH/USDT']);

    expect(report).toMatchObject({
      venueId: 'BINANCE',
      configuredMarketsFound: ['BTC/USDT'],
      marketCount: 1,
      balanceAssetCount: 1,
      feeSnapshotCount: 1,
      driftMicroseconds: '0',
      roundTripMicroseconds: '10000',
    });
    expect(
      (await subject.getTradingRules('BTC/USDT')).minimumNotional?.toString(),
    ).toBe('5');
    expect((await subject.getBalances())[0]?.total.toString()).toBe('0.3');
    expect(
      (await subject.getEffectiveFees(['BTC/USDT']))[0]?.maker.toString(),
    ).toBe('0.0009');
  });

  it('rejects credentials with trading or withdrawal permissions', async () => {
    const subject = adapter(
      fakeClient({
        enableReading: true,
        enableSpotAndMarginTrading: true,
        enableWithdrawals: true,
        enableInternalTransfer: true,
      }),
    );
    await expect(subject.getAccountStatus()).rejects.toMatchObject({
      code: 'authorization',
      retryable: false,
    } satisfies Partial<ProviderError>);
  });

  it('normalizes exact order-book snapshots without floating point conversion', async () => {
    const snapshot = await adapter().fetchOrderBook('BTC/USDT', 25);
    expect(snapshot).toMatchObject({
      venueId: 'BINANCE',
      marketId: 'BINANCE:BTCUSDT',
      kind: 'snapshot',
      sequence: '42',
    });
    expect(snapshot.bids[0]?.price.toString()).toBe('100');
    expect(snapshot.asks[0]?.quantity.toString()).toBe('3');
  });

  it('contains no calls to execution or funds-movement methods', () => {
    for (const file of ['adapter.ts', 'client.ts', 'factory.ts']) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect(source).not.toMatch(
        /\.(?:createOrder|cancelOrder|withdraw|transfer)\s*\(/,
      );
    }
  });
});

import type { ContractDetails } from '@stoqey/ib';
import { describe, expect, it, vi } from 'vitest';

import { IbkrReadOnlyAdapter } from './adapter';
import type { IbkrGatewayClient } from './client';
import { loadIbkrConfig } from './config';

function fixture(): ContractDetails {
  return {
    contract: {
      conId: 756733,
      symbol: 'SPY',
      secType: 'STK' as never,
      currency: 'USD',
      exchange: 'SMART',
      primaryExch: 'ARCA',
      localSymbol: 'SPY',
    },
    minTick: 0.01,
    timeZoneId: 'US/Eastern',
    tradingHours: '20260720:0400-20260720:2000',
    liquidHours: '20260720:0930-20260720:1600',
    longName: 'SPDR S&P 500 ETF TRUST',
  };
}

function client(accounts = ['DU123']): IbkrGatewayClient {
  return {
    connect: vi.fn(() => Promise.resolve()),
    currentTime: vi.fn(() => Promise.resolve(new Date('2026-07-18T17:00:00Z'))),
    managedAccounts: vi.fn(() => Promise.resolve(accounts)),
    contractDetails: vi.fn(() => Promise.resolve([fixture()])),
    historicalBars: vi.fn(() => Promise.resolve([])),
    disconnect: vi.fn(() => Promise.resolve()),
  };
}

const config = loadIbkrConfig({
  IBKR_CONNECTIVITY_ENABLED: 'true',
  IBKR_PAPER_ENABLED: 'true',
  IBKR_PAPER_EXECUTION_ENABLED: 'false',
  IBKR_HOST: '127.0.0.1',
  IBKR_PORT: '4002',
  IBKR_CLIENT_ID: '12',
  IBKR_ACCOUNT_ID: 'DU123',
  IBKR_CONTRACT_IDS: '756733',
});

describe('IbkrReadOnlyAdapter', () => {
  it('verifies the paper account and resolves an unambiguous conId', async () => {
    await expect(
      new IbkrReadOnlyAdapter(config, client()).verify(),
    ).resolves.toMatchObject({
      status: 'ok',
      environment: 'paper',
      accountMatched: true,
      contracts: [{ conId: '756733', symbol: 'SPY', minimumTick: '0.01' }],
    });
  });

  it('fails closed for live ports and mismatched accounts', async () => {
    expect(() =>
      loadIbkrConfig({
        ...process.env,
        IBKR_CONNECTIVITY_ENABLED: 'true',
        IBKR_PAPER_ENABLED: 'true',
        IBKR_PORT: '4001',
        IBKR_CLIENT_ID: '1',
        IBKR_ACCOUNT_ID: 'DU123',
      }),
    ).toThrow('paper port');
    await expect(
      new IbkrReadOnlyAdapter(config, client(['DU999'])).verify(),
    ).rejects.toThrow('not managed');
  });
});

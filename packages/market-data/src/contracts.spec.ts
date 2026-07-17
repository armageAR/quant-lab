import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Money,
  Price,
  Quantity,
  SourceTimestamp,
  eventTimepoint,
} from '@quant-lab/core';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedAccountReadProvider, Ticker } from './index';
import { ProviderError } from './errors';
import { tickerFixture, tradeFixture } from './testing';

describe('market-data contracts', () => {
  it('builds normalized events without venue-specific types', () => {
    const receivedAt = SourceTimestamp.fromEpochMilliseconds('1700000000000');
    const ticker: Ticker = {
      venueId: 'KRAKEN',
      marketId: 'BTC-USD',
      source: 'rest',
      time: eventTimepoint({ receivedAt, processedAt: receivedAt }),
      bid: Price.from('42000.01', 'BTC-USD'),
      bidQuantity: Quantity.from('0.5', 'BTC'),
    };

    expect(ticker.bid?.toJSON()).toEqual({
      value: '42000.01',
      marketId: 'BTC-USD',
    });
  });

  it('exposes authenticated account reads without order methods', () => {
    type Method = keyof AuthenticatedAccountReadProvider;
    const methods: Method[] = [
      'venue',
      'getCapabilities',
      'getAccountStatus',
      'getBalances',
      'getEffectiveFees',
    ];

    expect(methods).not.toContain('createOrder');
    expect(methods).not.toContain('cancelOrder');
    expect(Money.from('1', 'USD').currency).toBe('USD');
  });

  it('carries typed provider failure metadata without raw payloads', () => {
    const error = new ProviderError('request timed out', {
      code: 'timeout',
      venueId: 'BINANCE',
      operation: 'fetchTicker',
      retryable: true,
    });
    expect(error).toMatchObject({ code: 'timeout', retryable: true });
  });

  it('provides reusable normalized contract fixtures', () => {
    expect(tickerFixture().ask?.toString()).toBe('42000.02');
    expect(tradeFixture().quantity.toString()).toBe('0.125');
  });

  it('keeps package imports inside the declared boundary', () => {
    for (const file of [
      'events.ts',
      'errors.ts',
      'providers.ts',
      'testing.ts',
      'index.ts',
    ]) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      expect(source).not.toMatch(
        /from ['"](?:@prisma|@nestjs|ccxt|\.\.\/\.\.\/apps)/,
      );
    }
  });
});

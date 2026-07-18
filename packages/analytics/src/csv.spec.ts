import { describe, expect, it } from 'vitest';

import { recordsToCsv } from './csv';
import type { ResearchRecord } from './report';

const record = (overrides: Partial<ResearchRecord> = {}): ResearchRecord => ({
  canonicalSymbol: 'BTC/USD',
  direction: 'buy-binance-sell-kraken',
  classification: 'executable',
  evaluatedAt: '2026-07-18T00:00:00.000Z',
  topOfBookSpread: '0.01',
  grossProfit: '10',
  feeCost: '1',
  slippageCost: '0.5',
  netProfit: '8.5',
  buyFreshnessMs: 100,
  sellFreshnessMs: 200,
  crossVenueSkewMs: 50,
  ...overrides,
});

describe('recordsToCsv', () => {
  it('emits a stable header and one row per record', () => {
    const csv = recordsToCsv([record()]);
    const [header, row] = csv.split('\n');
    expect(header).toBe(
      'evaluatedAt,canonicalSymbol,direction,classification,topOfBookSpread,grossProfit,feeCost,slippageCost,netProfit,buyFreshnessMs,sellFreshnessMs,crossVenueSkewMs',
    );
    expect(row).toBe(
      '2026-07-18T00:00:00.000Z,BTC/USD,buy-binance-sell-kraken,executable,0.01,10,1,0.5,8.5,100,200,50',
    );
  });

  it('renders missing optional decimals as empty cells', () => {
    const csv = recordsToCsv([
      record({
        classification: 'rejected',
        topOfBookSpread: undefined,
        grossProfit: undefined,
        feeCost: undefined,
        slippageCost: undefined,
        netProfit: undefined,
      }),
    ]);
    const row = csv.split('\n')[1]!;
    expect(row).toBe(
      '2026-07-18T00:00:00.000Z,BTC/USD,buy-binance-sell-kraken,rejected,,,,,,100,200,50',
    );
  });

  it('escapes values that contain commas or quotes', () => {
    const csv = recordsToCsv([record({ direction: 'a,b"c' })]);
    expect(csv.split('\n')[1]).toContain('"a,b""c"');
  });

  it('is byte-identical for identical inputs', () => {
    const records = [record(), record({ classification: 'observed' })];
    expect(recordsToCsv(records)).toBe(recordsToCsv(records));
  });
});

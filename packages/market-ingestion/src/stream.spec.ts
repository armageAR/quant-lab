import type { Ticker } from '@quant-lab/market-data';
import { describe, expect, it, vi } from 'vitest';
import { PollingTickerStream } from './stream';

describe('PollingTickerStream', () => {
  it('reconnects after a source failure without duplicating', async () => {
    const ticker = {} as Ticker;
    const fetchTicker = vi
      .fn()
      .mockRejectedValueOnce(new Error('disconnect'))
      .mockResolvedValue(ticker);
    const persist = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    const stream = new PollingTickerStream(
      { venue: { id: 'TEST' }, fetchTicker },
      ['M'],
      persist,
      1,
      100,
    );
    const stats = await stream.run(100);
    expect(stats.reconnects).toBe(1);
    expect(stats.received).toBeGreaterThan(0);
    expect(stats.duplicates).toBeGreaterThan(0);
  });
  it('makes delayed polling gaps visible', async () => {
    const ticker = {} as Ticker;
    const fetchTicker = vi.fn().mockResolvedValue(ticker);
    const stream = new PollingTickerStream(
      { venue: { id: 'TEST' }, fetchTicker },
      ['M'],
      () => Promise.resolve(true),
      2,
      0,
    );
    const stats = await stream.run(100);
    expect(stats.gaps).toBeGreaterThan(0);
  });
});

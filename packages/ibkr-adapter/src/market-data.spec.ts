import { describe, expect, it } from 'vitest';
import { normalizeHistoricalBar, parseIbkrSessions } from './market-data';

describe('IBKR market data', () => {
  it('normalizes exact values and all three timestamps', () => {
    expect(
      normalizeHistoricalBar(
        756733,
        {
          time: '1784394000',
          open: 600.1,
          high: 601,
          low: 599.5,
          close: 600.8,
          volume: 1200,
          count: 42,
        },
        new Date('2026-07-18T17:00:01Z'),
      ),
    ).toMatchObject({
      conId: '756733',
      open: '600.1',
      volume: '1200',
      receivedAt: '2026-07-18T17:00:01.000Z',
      sourcePrecision: 'second',
    });
  });

  it('represents holidays as closed sessions', () => {
    expect(parseIbkrSessions('20260703:CLOSED;20260706:0930-1600')).toEqual([
      {
        date: '20260703',
        state: 'closed',
        opensAtLocal: null,
        closesAtLocal: null,
      },
      {
        date: '20260706',
        state: 'open',
        opensAtLocal: '0930',
        closesAtLocal: '1600',
      },
    ]);
  });
});

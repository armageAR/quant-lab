import type { Bar } from '@stoqey/ib';

export interface NormalizedIbkrBar {
  conId: string;
  eventTime: string;
  receivedAt: string;
  processedAt: string;
  sourcePrecision: 'second';
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradeCount: number | null;
}

export function normalizeHistoricalBar(
  conId: number,
  bar: Bar,
  receivedAt = new Date(),
): NormalizedIbkrBar {
  const eventTime = Number(bar.time);
  if (
    ![bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite)
  )
    throw new Error('IBKR historical bar has incomplete numeric data');
  if (!Number.isFinite(eventTime)) throw new Error('IBKR bar time is invalid');
  return {
    conId: String(conId),
    eventTime: new Date(eventTime * 1000).toISOString(),
    receivedAt: receivedAt.toISOString(),
    processedAt: new Date().toISOString(),
    sourcePrecision: 'second',
    open: String(bar.open),
    high: String(bar.high),
    low: String(bar.low),
    close: String(bar.close),
    volume: String(bar.volume),
    tradeCount: bar.count ?? null,
  };
}

export interface MarketSession {
  date: string;
  state: 'open' | 'closed';
  opensAtLocal: string | null;
  closesAtLocal: string | null;
}

export function parseIbkrSessions(value: string): MarketSession[] {
  return value
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const [date, range] = entry.split(':', 2);
      if (!date || !range) throw new Error('invalid IBKR session metadata');
      if (range === 'CLOSED')
        return {
          date,
          state: 'closed',
          opensAtLocal: null,
          closesAtLocal: null,
        };
      const [opensAtLocal, closesAtLocal] = range.split('-');
      if (!opensAtLocal || !closesAtLocal)
        throw new Error('invalid IBKR session range');
      return { date, state: 'open', opensAtLocal, closesAtLocal };
    });
}

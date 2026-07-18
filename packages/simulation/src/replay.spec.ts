import { describe, expect, it } from 'vitest';

import { replayDeterministically, type ReplayEvent } from './replay';

const event = (ordinal: number, receivedAt: string): ReplayEvent => ({
  ordinal,
  sourceId: `source-${ordinal}`,
  eventType: 'ticker',
  marketId: 'BINANCE:BTCUSDT',
  venueId: 'BINANCE',
  receivedAt,
  payload: { bid: '100' },
});

describe('replayDeterministically', () => {
  it('produces identical hashes for identical inputs and seed', async () => {
    const events = [
      event(0, '2026-07-18T00:00:00.000Z'),
      event(1, '2026-07-18T00:00:01.000Z'),
    ];
    const handler = (item: ReplayEvent) => item.sourceId;
    const first = await replayDeterministically(events, 7, handler);
    const second = await replayDeterministically(events, 7, handler);
    expect(first).toEqual(second);
  });

  it('fails explicitly for ambiguous ordering', async () => {
    await expect(
      replayDeterministically(
        [
          event(0, '2026-07-18T00:00:00.000Z'),
          event(0, '2026-07-18T00:00:00.000Z'),
        ],
        1,
        () => undefined,
      ),
    ).rejects.toThrow('ordering is ambiguous');
  });

  it('fails when received time moves backwards', async () => {
    await expect(
      replayDeterministically(
        [
          event(0, '2026-07-18T00:00:01.000Z'),
          event(1, '2026-07-18T00:00:00.000Z'),
        ],
        1,
        () => undefined,
      ),
    ).rejects.toThrow('not monotonic');
  });
});

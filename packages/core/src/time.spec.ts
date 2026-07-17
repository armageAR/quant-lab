import { describe, expect, it } from 'vitest';

import { eventTimepoint, SourceTimestamp } from './time';

describe('source timestamps', () => {
  it('preserves original precision without fabricating microseconds', () => {
    const milliseconds = SourceTimestamp.fromEpochMilliseconds(
      '1700000000123',
      '1700000000123',
    );
    expect(milliseconds.toJSON()).toEqual({
      epochMicroseconds: '1700000000123000',
      iso8601: '2023-11-14T22:13:20.123000Z',
      precision: 'millisecond',
      sourceValue: '1700000000123',
    });

    const microseconds =
      SourceTimestamp.fromEpochMicroseconds('1700000000123456');
    expect(microseconds.toJSON().iso8601).toBe('2023-11-14T22:13:20.123456Z');
    expect(
      SourceTimestamp.fromSerialized(microseconds.toJSON()).toJSON(),
    ).toEqual(microseconds.toJSON());
  });

  it('keeps missing event time explicit and validates local processing order', () => {
    const receivedAt = SourceTimestamp.fromEpochMicroseconds('1000001');
    const processedAt = SourceTimestamp.fromEpochMicroseconds('1000002');
    expect(
      eventTimepoint({ receivedAt, processedAt }).eventTime,
    ).toBeUndefined();
    expect(() =>
      eventTimepoint({ receivedAt: processedAt, processedAt: receivedAt }),
    ).toThrow(RangeError);
  });
});

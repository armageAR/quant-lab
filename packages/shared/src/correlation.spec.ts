import { describe, expect, it } from 'vitest';

import {
  getCorrelationContext,
  normalizeCorrelationId,
  runWithCorrelation,
} from './correlation';

describe('correlation context', () => {
  it('preserves isolated concurrent contexts', async () => {
    const values = await Promise.all(
      ['first', 'second'].map((correlationId) =>
        runWithCorrelation({ correlationId }, async () => {
          await Promise.resolve();
          return getCorrelationContext()?.correlationId;
        }),
      ),
    );

    expect(values).toEqual(['first', 'second']);
  });

  it('replaces unsafe incoming identifiers', () => {
    expect(normalizeCorrelationId('safe-id')).toBe('safe-id');
    expect(normalizeCorrelationId('x'.repeat(129))).not.toBe('x'.repeat(129));
    expect(normalizeCorrelationId('unsafe value')).not.toBe('unsafe value');
  });
});

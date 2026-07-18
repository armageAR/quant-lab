import { describe, expect, it } from 'vitest';

import { DISPLAY_TIME_ZONE, formatDateTime } from './time';

describe('dashboard date formatting', () => {
  it('renders UTC instants in Argentina GMT-3 time', () => {
    expect(DISPLAY_TIME_ZONE).toBe('America/Argentina/Buenos_Aires');
    expect(formatDateTime('2026-07-18T00:00:00.000Z')).toContain('21:00:00');
  });

  it('does not expose invalid dates', () => {
    expect(formatDateTime('invalid')).toBe('—');
    expect(formatDateTime()).toBe('—');
  });
});

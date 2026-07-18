import { describe, expect, it } from 'vitest';

import { researchReportConfigFromEnv } from './config';

describe('researchReportConfigFromEnv', () => {
  it('accepts false-positive rates within the inclusive unit interval', () => {
    expect(
      researchReportConfigFromEnv({ RESEARCH_MAX_FALSE_POSITIVE_RATE: '0' })
        .thresholds.maxFalsePositiveRate,
    ).toBe('0');
    expect(
      researchReportConfigFromEnv({ RESEARCH_MAX_FALSE_POSITIVE_RATE: '1' })
        .thresholds.maxFalsePositiveRate,
    ).toBe('1');
  });

  it('rejects false-positive rates outside the unit interval', () => {
    expect(() =>
      researchReportConfigFromEnv({
        RESEARCH_MAX_FALSE_POSITIVE_RATE: '-0.1',
      }),
    ).toThrow('between 0 and 1');
    expect(() =>
      researchReportConfigFromEnv({
        RESEARCH_MAX_FALSE_POSITIVE_RATE: '1.1',
      }),
    ).toThrow('between 0 and 1');
  });
});

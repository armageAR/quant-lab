import { describe, expect, it } from 'vitest';

import { grossProfitFor100 } from './gross-profit';

describe('grossProfitFor100', () => {
  it('calculates gross USD profit from an exact spread rate', () => {
    expect(grossProfitFor100('0.000007497033985929')).toBe('$0.0007');
    expect(grossProfitFor100('0.012345')).toBe('$1.2345');
  });

  it('preserves losses and rejects missing rates', () => {
    expect(grossProfitFor100('-0.000300192319983448')).toBe('-$0.0300');
    expect(grossProfitFor100()).toBeUndefined();
  });
});

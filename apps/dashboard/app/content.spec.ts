import { describe, expect, it } from 'vitest';

import { capabilities, liveExecutionStatus } from './content';

describe('dashboard content', () => {
  it('communicates the live execution safety default', () => {
    expect(liveExecutionStatus).toBe('DISABLED BY DEFAULT');
  });

  it('reports every Phase 1 runtime capability', () => {
    expect(capabilities.map(([name]) => name)).toEqual([
      'API',
      'Worker',
      'Database',
    ]);
  });
});

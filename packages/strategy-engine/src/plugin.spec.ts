import { describe, expect, it, vi } from 'vitest';

import {
  StrategyCompatibilityError,
  StrategyRegistry,
  noopStrategy,
} from './plugin';

const context = {
  runId: 'run-1',
  capabilities: new Set(['order-book']),
  assetClasses: new Set(['spot']),
  marketIds: ['BINANCE:BTCUSDT', 'KRAKEN:BTCUSDT'],
};

describe('StrategyRegistry', () => {
  it('loads, validates, runs and versions a plugin independently', async () => {
    const registry = new StrategyRegistry();
    registry.register(noopStrategy);

    await expect(
      registry.run({
        id: 'reference.noop',
        version: '1.0.0',
        configuration: {},
        event: {},
        context,
      }),
    ).resolves.toEqual({ signals: [] });
    expect(registry.list()[0]?.version).toBe('1.0.0');
  });

  it('rejects duplicate versions and malformed semantic versions', () => {
    const registry = new StrategyRegistry();
    registry.register(noopStrategy);
    expect(() => registry.register(noopStrategy)).toThrow('already registered');
    expect(() =>
      registry.register({
        ...noopStrategy,
        metadata: { ...noopStrategy.metadata, version: 'latest' },
      }),
    ).toThrow('semantic version');
  });

  it('fails requirements before initialization or execution', async () => {
    const initialize = vi.fn();
    const execute = vi.fn();
    const registry = new StrategyRegistry();
    registry.register({
      ...noopStrategy,
      metadata: {
        ...noopStrategy.metadata,
        id: 'requires-depth',
        requirements: {
          capabilities: ['market-depth'],
          assetClasses: ['spot'],
          minimumMarkets: 3,
        },
      },
      initialize,
      execute,
    });

    await expect(
      registry.run({
        id: 'requires-depth',
        version: '1.0.0',
        configuration: {},
        event: {},
        context,
      }),
    ).rejects.toBeInstanceOf(StrategyCompatibilityError);
    expect(initialize).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});

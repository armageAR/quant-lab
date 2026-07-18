import { expect, it } from 'vitest';
import { StrategyRegistry } from './plugin';
import { equityLongOnlyStrategy } from './equity-long-only';

it('emits only long-only intents during an open session', async () => {
  const registry = new StrategyRegistry();
  registry.register(equityLongOnlyStrategy);
  const output = await registry.run<
    { entryBelow: string; exitAbove: string; quantity: string },
    { conId: string; close: string; position: string; sessionOpen: boolean },
    { signals: { side: string }[] }
  >({
    id: 'reference.equity-long-only',
    version: '1.0.0',
    configuration: { entryBelow: '100', exitAbove: '110', quantity: '2' },
    event: { conId: '1', close: '99', position: '0', sessionOpen: true },
    context: {
      runId: 'r',
      capabilities: new Set(['historical-bars']),
      assetClasses: new Set(['equity']),
      marketIds: ['1'],
    },
  });
  expect(output.signals).toEqual([
    { conId: '1', side: 'buy', quantity: '2', reason: 'entry_threshold' },
  ]);
});

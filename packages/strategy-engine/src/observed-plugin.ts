import { z } from 'zod';

import {
  ObservedArbitrageDetector,
  type ObservedBookInput,
  type ObservedOpportunityResult,
} from './observed-arbitrage';
import type { StrategyPlugin } from './plugin';

export const observedArbitrageConfiguration = z.object({
  maximumBookAgeMs: z.number().int().positive(),
  maximumCrossVenueSkewMs: z.number().int().nonnegative(),
  minimumObservedSpread: z.string().regex(/^-?\d+(?:\.\d+)?$/),
});

export interface ObservedArbitragePluginInput {
  canonicalSymbol: string;
  buy: ObservedBookInput;
  sell: ObservedBookInput;
  evaluatedAt: Date;
}

export function createObservedArbitragePlugin(input: {
  version: string;
  commitSha: string;
}): StrategyPlugin<
  z.infer<typeof observedArbitrageConfiguration>,
  ObservedArbitragePluginInput,
  ObservedOpportunityResult
> {
  return {
    metadata: {
      id: 'cross-venue-observed',
      name: 'Cross-venue observed arbitrage',
      version: input.version,
      commitSha: input.commitSha,
      description: 'Compares fresh books without claiming executable profit.',
      requirements: {
        capabilities: ['order-book'],
        assetClasses: ['spot'],
        minimumMarkets: 2,
      },
    },
    configuration: observedArbitrageConfiguration,
    execute(event, _context, configuration) {
      return new ObservedArbitrageDetector({
        id: 'cross-venue-observed',
        version: input.version,
        ...configuration,
      }).evaluate(
        event.canonicalSymbol,
        event.buy,
        event.sell,
        event.evaluatedAt,
      );
    },
  };
}

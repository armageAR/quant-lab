import Decimal from 'decimal.js';
import { z } from 'zod';
import type { StrategyPlugin } from './plugin';

const configuration = z.object({
  entryBelow: z.string().refine((value) => new Decimal(value).gt(0)),
  exitAbove: z.string().refine((value) => new Decimal(value).gt(0)),
  quantity: z
    .string()
    .refine(
      (value) => new Decimal(value).isInteger() && new Decimal(value).gt(0),
    ),
});
type Config = z.infer<typeof configuration>;
export interface EquitySignalInput {
  conId: string;
  close: string;
  position: string;
  sessionOpen: boolean;
}
export interface EquityIntent {
  conId: string;
  side: 'buy' | 'sell';
  quantity: string;
  reason: string;
}

export const equityLongOnlyStrategy = {
  metadata: {
    id: 'reference.equity-long-only',
    name: 'Equity long-only threshold',
    version: '1.0.0',
    commitSha: 'built-in',
    description: 'Reference stock/ETF strategy; it is not arbitrage.',
    requirements: {
      capabilities: ['historical-bars'],
      assetClasses: ['equity'],
      minimumMarkets: 1,
    },
  },
  configuration,
  execute(
    input: EquitySignalInput,
    _context,
    config: Config,
  ): { signals: EquityIntent[] } {
    if (!input.sessionOpen) return { signals: [] };
    const close = new Decimal(input.close);
    const position = new Decimal(input.position);
    if (position.eq(0) && close.lte(config.entryBelow))
      return {
        signals: [
          {
            conId: input.conId,
            side: 'buy',
            quantity: config.quantity,
            reason: 'entry_threshold',
          },
        ],
      };
    if (position.gt(0) && close.gte(config.exitAbove))
      return {
        signals: [
          {
            conId: input.conId,
            side: 'sell',
            quantity: position.toString(),
            reason: 'exit_threshold',
          },
        ],
      };
    return { signals: [] };
  },
} satisfies StrategyPlugin<
  Config,
  EquitySignalInput,
  { signals: EquityIntent[] }
>;

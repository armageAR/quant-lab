import Decimal from 'decimal.js';

export interface StrategyIntent {
  id: string;
  marketId: string;
  notional: string;
  confidence: string;
}

export interface PortfolioPolicy {
  maximumIntentNotional: string;
  maximumTotalNotional: string;
  minimumConfidence: string;
  maximumSignals: number;
  allowedMarkets: readonly string[];
}

export interface PortfolioDecision {
  intentId: string;
  status: 'accepted' | 'reduced' | 'rejected';
  approvedNotional: string;
  reasons: readonly string[];
}

export function applyPortfolioPolicy(
  intents: readonly StrategyIntent[],
  policy: PortfolioPolicy,
): readonly PortfolioDecision[] {
  const maxIntent = exact(policy.maximumIntentNotional);
  const maxTotal = exact(policy.maximumTotalNotional);
  const minimumConfidence = exact(policy.minimumConfidence);
  let allocated = new Decimal(0);
  let accepted = 0;
  return intents.map((intent) => {
    const requested = exact(intent.notional);
    const reasons: string[] = [];
    if (!policy.allowedMarkets.includes(intent.marketId))
      reasons.push('market_not_allowed');
    if (exact(intent.confidence).lessThan(minimumConfidence))
      reasons.push('confidence_below_minimum');
    if (accepted >= policy.maximumSignals) reasons.push('signal_limit');
    if (reasons.length)
      return {
        intentId: intent.id,
        status: 'rejected' as const,
        approvedNotional: '0',
        reasons,
      };
    const remaining = Decimal.max(0, maxTotal.minus(allocated));
    const approved = Decimal.min(requested, maxIntent, remaining);
    if (approved.isZero())
      return {
        intentId: intent.id,
        status: 'rejected' as const,
        approvedNotional: '0',
        reasons: ['capital_exhausted'],
      };
    allocated = allocated.plus(approved);
    accepted += 1;
    const reduced = approved.lessThan(requested);
    return {
      intentId: intent.id,
      status: reduced ? ('reduced' as const) : ('accepted' as const),
      approvedNotional: approved.toFixed(),
      reasons: reduced ? ['portfolio_limit'] : [],
    };
  });
}

function exact(value: string): Decimal {
  const parsed = new Decimal(value);
  if (parsed.isNegative())
    throw new RangeError('portfolio values cannot be negative');
  return parsed;
}

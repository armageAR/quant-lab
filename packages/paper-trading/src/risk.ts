import { decimal, type PaperRiskLimits, type RiskContext } from './model';

export function evaluateRisk(
  limits: PaperRiskLimits,
  context: RiskContext,
): string[] {
  const reasons: string[] = [];
  if (decimal(context.orderNotional).greaterThan(limits.maximumOrderNotional))
    reasons.push('maximum_order_notional');
  if (decimal(context.venueExposure).greaterThan(limits.maximumVenueExposure))
    reasons.push('maximum_venue_exposure');
  if (
    decimal(context.dailyPnl).lessThan(
      decimal(limits.maximumDailyLoss).negated(),
    )
  )
    reasons.push('maximum_daily_loss');
  if (context.feedAgeMs > limits.maximumFeedAgeMs) reasons.push('stale_feed');
  if (
    decimal(context.inventoryImbalance)
      .abs()
      .greaterThan(limits.maximumInventoryImbalance)
  )
    reasons.push('inventory_imbalance');
  return reasons;
}

import Decimal from 'decimal.js';

const ExactDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_EVEN,
});
export const decimal = (value: string) => new ExactDecimal(value);
export const canonical = (value: Decimal.Value) => {
  const result = new ExactDecimal(value).toFixed();
  return result === '-0' ? '0' : result;
};

export type PaperOrderStatus =
  | 'created'
  | 'reserved'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'failed';
export type PaperSessionStatus =
  'draft' | 'running' | 'paused' | 'stopped' | 'emergency_stopped';
export interface ExecutionIntent {
  idempotencyKey: string;
  correlationId: string;
  opportunityId?: string;
  strategyVersion: string;
  venueId: string;
  marketId: string;
  side: 'buy' | 'sell';
  baseAsset: string;
  quoteAsset: string;
  quantity: string;
  expectedPrice: string;
  expectedProfit?: string;
}
export interface SimulatedFill {
  idempotencyKey: string;
  quantity: string;
  price: string;
  feeRate: string;
  occurredAt: Date;
  evidence: Record<string, unknown>;
}
export interface PaperRiskLimits {
  maximumOrderNotional: string;
  maximumVenueExposure: string;
  maximumDailyLoss: string;
  maximumFeedAgeMs: number;
  maximumInventoryImbalance: string;
}
export interface RiskContext {
  orderNotional: string;
  venueExposure: string;
  dailyPnl: string;
  feedAgeMs: number;
  inventoryImbalance: string;
}

export function nextOrderStatus(
  current: PaperOrderStatus,
  event: 'reserve' | 'partial_fill' | 'fill' | 'cancel' | 'reject' | 'fail',
): PaperOrderStatus {
  const transitions: Record<
    PaperOrderStatus,
    Partial<Record<typeof event, PaperOrderStatus>>
  > = {
    created: {
      reserve: 'reserved',
      reject: 'rejected',
      fail: 'failed',
      cancel: 'cancelled',
    },
    reserved: {
      partial_fill: 'partially_filled',
      fill: 'filled',
      cancel: 'cancelled',
      fail: 'failed',
    },
    partially_filled: {
      partial_fill: 'partially_filled',
      fill: 'filled',
      cancel: 'cancelled',
      fail: 'failed',
    },
    filled: {},
    cancelled: {},
    rejected: {},
    failed: {},
  };
  const result = transitions[current][event];
  if (!result)
    throw new RangeError(
      `invalid paper order transition: ${current} -> ${event}`,
    );
  return result;
}

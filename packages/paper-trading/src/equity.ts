import Decimal from 'decimal.js';

export interface EquityPaperState {
  cashUsd: string;
  positions: Record<string, string>;
  realizedPnlUsd: string;
  feesUsd: string;
}
export interface EquityPaperOrder {
  intentId: string;
  conId: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  sessionOpen: boolean;
  quoteAgeMs: number;
}
export interface EquityRiskLimits {
  allowlist: ReadonlySet<string>;
  maxOrderNotionalUsd: string;
  maxPositionNotionalUsd: string;
  maxQuoteAgeMs: number;
  commissionUsd: string;
  minimumTick: string;
}

export function executeEquityPaperOrder(
  state: EquityPaperState,
  order: EquityPaperOrder,
  limits: EquityRiskLimits,
): EquityPaperState {
  if (!limits.allowlist.has(order.conId))
    throw new Error('instrument_not_allowlisted');
  if (!order.sessionOpen) throw new Error('market_closed');
  if (order.quoteAgeMs > limits.maxQuoteAgeMs) throw new Error('stale_quote');
  const quantity = new Decimal(order.quantity);
  const price = new Decimal(order.price);
  if (!quantity.isInteger() || quantity.lte(0))
    throw new Error('invalid_quantity');
  if (!price.div(limits.minimumTick).isInteger())
    throw new Error('invalid_tick');
  const notional = quantity.mul(price);
  const fee = new Decimal(limits.commissionUsd);
  if (notional.gt(limits.maxOrderNotionalUsd))
    throw new Error('max_order_notional');
  const current = new Decimal(state.positions[order.conId] ?? 0);
  const next =
    order.side === 'buy' ? current.plus(quantity) : current.minus(quantity);
  if (next.lt(0)) throw new Error('short_sales_unsupported');
  if (next.mul(price).gt(limits.maxPositionNotionalUsd))
    throw new Error('max_position_notional');
  const cashDelta =
    order.side === 'buy' ? notional.plus(fee).negated() : notional.minus(fee);
  const cash = new Decimal(state.cashUsd).plus(cashDelta);
  if (cash.lt(0)) throw new Error('insufficient_settled_cash');
  return {
    cashUsd: cash.toString(),
    positions: { ...state.positions, [order.conId]: next.toString() },
    realizedPnlUsd: state.realizedPnlUsd,
    feesUsd: new Decimal(state.feesUsd).plus(fee).toString(),
  };
}

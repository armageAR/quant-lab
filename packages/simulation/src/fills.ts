import Decimal from 'decimal.js';

const ExactDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1_000_000,
  toExpPos: 1_000_000,
});

export interface BookLevel {
  price: string;
  quantity: string;
}

export interface ExecutionBook {
  eventId: string;
  marketId: string;
  venueId: string;
  receivedAt: string;
  valid: boolean;
  bids: readonly BookLevel[];
  asks: readonly BookLevel[];
  availableUntil?: string;
}

export interface FillModelConfig {
  version: string;
  allowPartialFills: boolean;
  queueAheadRate: string;
  marketImpactRate: string;
  maxLevelParticipationRate: string;
}

export interface FillRequest {
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: string;
  submittedAt: string;
  latencyMs: number;
  cancelAfterMs: number;
  feeRate: string;
  slippageRate: string;
  limitPrice?: string;
}

export interface FillEvidenceLevel {
  price: string;
  availableQuantity: string;
  filledQuantity: string;
}

export interface SimulatedFill {
  status: 'filled' | 'partial' | 'unfilled' | 'cancelled';
  reason:
    | 'filled'
    | 'partial_depth'
    | 'insufficient_depth'
    | 'invalid_book'
    | 'liquidity_disappeared'
    | 'cancelled_before_arrival'
    | 'limit_not_crossed';
  requestedQuantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  averagePrice?: string;
  quoteAmount: string;
  fee: string;
  slippageCost: string;
  arrivedAt: string;
  modelVersion: string;
  evidence: {
    bookEventId: string;
    marketId: string;
    venueId: string;
    levels: readonly FillEvidenceLevel[];
  };
}

function canonical(value: Decimal): string {
  const result = value.toFixed();
  return result === '-0' ? '0' : result;
}

function decimal(value: string, field: string, allowZero = true): Decimal {
  const parsed = new ExactDecimal(value);
  if (
    !parsed.isFinite() ||
    parsed.isNegative() ||
    (!allowZero && parsed.isZero())
  )
    throw new RangeError(`${field} must be a positive decimal`);
  return parsed;
}

function time(value: string, field: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) throw new RangeError(`${field} is invalid`);
  return parsed;
}

function emptyFill(
  request: FillRequest,
  book: ExecutionBook,
  arrivedAt: Date,
  model: FillModelConfig,
  status: 'unfilled' | 'cancelled',
  reason: SimulatedFill['reason'],
): SimulatedFill {
  return {
    status,
    reason,
    requestedQuantity: request.quantity,
    filledQuantity: '0',
    remainingQuantity: request.quantity,
    quoteAmount: '0',
    fee: '0',
    slippageCost: '0',
    arrivedAt: arrivedAt.toISOString(),
    modelVersion: model.version,
    evidence: {
      bookEventId: book.eventId,
      marketId: book.marketId,
      venueId: book.venueId,
      levels: [],
    },
  };
}

export function simulateFill(
  request: FillRequest,
  book: ExecutionBook,
  model: FillModelConfig,
  depleted: ReadonlyMap<string, string> = new Map(),
): SimulatedFill {
  const requested = decimal(request.quantity, 'quantity', false);
  const feeRate = decimal(request.feeRate, 'feeRate');
  const slippageRate = decimal(request.slippageRate, 'slippageRate');
  const queueAheadRate = decimal(model.queueAheadRate, 'queueAheadRate');
  const impactRate = decimal(model.marketImpactRate, 'marketImpactRate');
  const participation = decimal(
    model.maxLevelParticipationRate,
    'maxLevelParticipationRate',
    false,
  );
  if (queueAheadRate.greaterThan(1) || participation.greaterThan(1))
    throw new RangeError('fill model rates must not exceed one');
  if (!Number.isInteger(request.latencyMs) || request.latencyMs < 0)
    throw new RangeError('latencyMs must be a non-negative integer');
  if (!Number.isInteger(request.cancelAfterMs) || request.cancelAfterMs < 0)
    throw new RangeError('cancelAfterMs must be a non-negative integer');

  const submitted = time(request.submittedAt, 'submittedAt');
  const arrival = new Date(submitted + request.latencyMs);
  if (request.cancelAfterMs < request.latencyMs)
    return emptyFill(
      request,
      book,
      arrival,
      model,
      'cancelled',
      'cancelled_before_arrival',
    );
  if (!book.valid)
    return emptyFill(request, book, arrival, model, 'unfilled', 'invalid_book');
  if (
    book.availableUntil &&
    arrival.getTime() > time(book.availableUntil, 'availableUntil')
  )
    return emptyFill(
      request,
      book,
      arrival,
      model,
      'unfilled',
      'liquidity_disappeared',
    );

  const levels = request.side === 'buy' ? book.asks : book.bids;
  const limit = request.limitPrice
    ? decimal(request.limitPrice, 'limitPrice', false)
    : undefined;
  let remaining = requested;
  let filled = new ExactDecimal(0);
  let rawQuote = new ExactDecimal(0);
  let adjustedQuote = new ExactDecimal(0);
  const evidence: FillEvidenceLevel[] = [];
  for (
    let index = 0;
    index < levels.length && remaining.greaterThan(0);
    index += 1
  ) {
    const level = levels[index]!;
    const price = decimal(level.price, 'level price', false);
    if (
      request.orderType === 'limit' &&
      limit &&
      ((request.side === 'buy' && price.greaterThan(limit)) ||
        (request.side === 'sell' && price.lessThan(limit)))
    )
      continue;
    const levelKey = `${book.eventId}:${request.side}:${index}`;
    const previouslyDepleted = decimal(
      depleted.get(levelKey) ?? '0',
      'depletion',
    );
    let available = Decimal.max(
      0,
      decimal(level.quantity, 'level quantity').minus(previouslyDepleted),
    ).times(participation);
    if (request.orderType === 'limit')
      available = available.times(new ExactDecimal(1).minus(queueAheadRate));
    const quantity = Decimal.min(available, remaining);
    if (quantity.lessThanOrEqualTo(0)) continue;
    const progress = filled.plus(quantity).dividedBy(requested);
    const adverseRate = slippageRate.plus(impactRate.times(progress));
    const adjustedPrice =
      request.side === 'buy'
        ? price.times(new ExactDecimal(1).plus(adverseRate))
        : price.times(Decimal.max(0, new ExactDecimal(1).minus(adverseRate)));
    filled = filled.plus(quantity);
    remaining = remaining.minus(quantity);
    rawQuote = rawQuote.plus(price.times(quantity));
    adjustedQuote = adjustedQuote.plus(adjustedPrice.times(quantity));
    evidence.push({
      price: canonical(price),
      availableQuantity: canonical(available),
      filledQuantity: canonical(quantity),
    });
  }

  if (filled.isZero())
    return emptyFill(
      request,
      book,
      arrival,
      model,
      'unfilled',
      request.orderType === 'limit'
        ? 'limit_not_crossed'
        : 'insufficient_depth',
    );
  if (remaining.greaterThan(0) && !model.allowPartialFills)
    return emptyFill(
      request,
      book,
      arrival,
      model,
      'unfilled',
      'insufficient_depth',
    );
  const slippageCost = adjustedQuote.minus(rawQuote).abs();
  const fee = adjustedQuote.times(feeRate);
  return {
    status: remaining.isZero() ? 'filled' : 'partial',
    reason: remaining.isZero() ? 'filled' : 'partial_depth',
    requestedQuantity: canonical(requested),
    filledQuantity: canonical(filled),
    remainingQuantity: canonical(remaining),
    averagePrice: canonical(adjustedQuote.dividedBy(filled)),
    quoteAmount: canonical(adjustedQuote),
    fee: canonical(fee),
    slippageCost: canonical(slippageCost),
    arrivedAt: arrival.toISOString(),
    modelVersion: model.version,
    evidence: {
      bookEventId: book.eventId,
      marketId: book.marketId,
      venueId: book.venueId,
      levels: evidence,
    },
  };
}

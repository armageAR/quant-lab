import Decimal from 'decimal.js';

import {
  simulateFill,
  type BookLevel,
  type ExecutionBook,
  type FillModelConfig,
  type SimulatedFill,
} from './fills';
import {
  replayDeterministically,
  type ReplayEvent,
  type ReplayOptions,
} from './replay';
import type {
  BacktestExecutionResult,
  BacktestRunView,
  JsonObject,
} from './runs';

const ExactDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1_000_000,
  toExpPos: 1_000_000,
});

export interface BacktestScenarioConfig {
  scenario: 'base' | 'conservative' | 'adverse';
  tradeSize: string;
  orderType: 'market' | 'limit';
  submissionDelayMs: number;
  cancelAfterMs: number;
  feeRates: Readonly<Record<string, string>>;
  slippageRate: string;
  inventoryRebalanceRate: string;
  fillModel: FillModelConfig;
}

export interface SimulatedArbitrageTrade {
  observedAt: string;
  canonicalSymbol: string;
  buyVenueId: string;
  sellVenueId: string;
  requestedQuantity: string;
  matchedQuantity: string;
  inventoryImbalance: string;
  grossProfit: string;
  feeCost: string;
  slippageCost: string;
  rebalancingCost: string;
  netProfit: string;
  capitalRequired: string;
  buyFill: SimulatedFill;
  sellFill: SimulatedFill;
}

interface OrderBookPayload {
  kind: 'orderBook';
  eventId: string;
  valid: boolean;
  bids: readonly BookLevel[];
  asks: readonly BookLevel[];
}

function canonical(value: Decimal): string {
  const result = value.toFixed();
  return result === '-0' ? '0' : result;
}

function positive(value: unknown, field: string, allowZero = true): string {
  if (typeof value !== 'string')
    throw new TypeError(`${field} must be a decimal string`);
  const parsed = new ExactDecimal(value);
  if (
    !parsed.isFinite() ||
    parsed.isNegative() ||
    (!allowZero && parsed.isZero())
  )
    throw new RangeError(`${field} must be positive`);
  return canonical(parsed);
}

function integer(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0)
    throw new RangeError(`${field} must be a non-negative integer`);
  return value as number;
}

function isBook(payload: unknown): payload is OrderBookPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<OrderBookPayload>;
  return (
    value.kind === 'orderBook' &&
    typeof value.eventId === 'string' &&
    typeof value.valid === 'boolean' &&
    Array.isArray(value.bids) &&
    Array.isArray(value.asks)
  );
}

export function parseBacktestConfig(value: JsonObject): BacktestScenarioConfig {
  const scenario = value.scenario ?? 'base';
  const orderType = value.orderType ?? 'market';
  if (
    typeof scenario !== 'string' ||
    !['base', 'conservative', 'adverse'].includes(scenario)
  )
    throw new RangeError('scenario is invalid');
  if (typeof orderType !== 'string' || !['market', 'limit'].includes(orderType))
    throw new RangeError('orderType is invalid');
  const feeRates = value.feeRates;
  if (!feeRates || typeof feeRates !== 'object' || Array.isArray(feeRates))
    throw new TypeError('feeRates must be an object');
  const fill = value.fillModel;
  if (!fill || typeof fill !== 'object' || Array.isArray(fill))
    throw new TypeError('fillModel must be an object');
  const fillValue = fill as JsonObject;
  const parsed: BacktestScenarioConfig = {
    scenario: scenario as BacktestScenarioConfig['scenario'],
    tradeSize: positive(value.tradeSize, 'tradeSize', false),
    orderType: orderType as BacktestScenarioConfig['orderType'],
    submissionDelayMs: integer(value.submissionDelayMs, 'submissionDelayMs'),
    cancelAfterMs: integer(value.cancelAfterMs, 'cancelAfterMs'),
    feeRates: Object.fromEntries(
      Object.entries(feeRates).map(([venue, rate]) => [
        venue,
        positive(rate, `feeRates.${venue}`),
      ]),
    ),
    slippageRate: positive(value.slippageRate, 'slippageRate'),
    inventoryRebalanceRate: positive(
      value.inventoryRebalanceRate,
      'inventoryRebalanceRate',
    ),
    fillModel: {
      version:
        typeof fillValue.version === 'string' && fillValue.version
          ? fillValue.version
          : 'fill-v1',
      allowPartialFills: fillValue.allowPartialFills === true,
      queueAheadRate: positive(fillValue.queueAheadRate, 'queueAheadRate'),
      marketImpactRate: positive(
        fillValue.marketImpactRate,
        'marketImpactRate',
      ),
      maxLevelParticipationRate: positive(
        fillValue.maxLevelParticipationRate,
        'maxLevelParticipationRate',
        false,
      ),
    },
  };
  if (parsed.scenario === 'base') return parsed;
  const adverse = parsed.scenario === 'adverse';
  const multiplier = new ExactDecimal(adverse ? 2 : 1.5);
  return {
    ...parsed,
    submissionDelayMs: Math.ceil(
      parsed.submissionDelayMs * multiplier.toNumber(),
    ),
    slippageRate: canonical(
      new ExactDecimal(parsed.slippageRate).times(multiplier),
    ),
    fillModel: {
      ...parsed.fillModel,
      queueAheadRate: canonical(
        Decimal.min(
          1,
          new ExactDecimal(parsed.fillModel.queueAheadRate).plus(
            adverse ? '0.25' : '0.1',
          ),
        ),
      ),
      marketImpactRate: canonical(
        new ExactDecimal(parsed.fillModel.marketImpactRate).times(multiplier),
      ),
      maxLevelParticipationRate: canonical(
        new ExactDecimal(parsed.fillModel.maxLevelParticipationRate).times(
          adverse ? '0.5' : '0.75',
        ),
      ),
    },
  };
}

function futureAvailability(
  events: readonly ReplayEvent[],
): Map<string, string> {
  const next = new Map<string, string>();
  const result = new Map<string, string>();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (!isBook(event.payload)) continue;
    const later = next.get(event.marketId);
    if (later) result.set(event.sourceId, later);
    next.set(event.marketId, event.receivedAt);
  }
  return result;
}

function asExecutionBook(
  event: ReplayEvent,
  availableUntil: string | undefined,
): ExecutionBook | undefined {
  if (!isBook(event.payload)) return undefined;
  return {
    eventId: event.payload.eventId,
    marketId: event.marketId,
    venueId: event.venueId,
    receivedAt: event.receivedAt,
    valid: event.payload.valid,
    bids: event.payload.bids,
    asks: event.payload.asks,
    ...(availableUntil ? { availableUntil } : {}),
  };
}

function trade(
  symbol: string,
  observedAt: string,
  buyBook: ExecutionBook,
  sellBook: ExecutionBook,
  config: BacktestScenarioConfig,
): SimulatedArbitrageTrade | undefined {
  const bestAsk = buyBook.asks[0];
  const bestBid = sellBook.bids[0];
  if (!bestAsk || !bestBid) return undefined;
  if (!new ExactDecimal(bestBid.price).greaterThan(bestAsk.price))
    return undefined;
  const common = {
    orderType: config.orderType,
    quantity: config.tradeSize,
    submittedAt: observedAt,
    latencyMs: config.submissionDelayMs,
    cancelAfterMs: config.cancelAfterMs,
    slippageRate: config.slippageRate,
  } as const;
  const buyFill = simulateFill(
    {
      ...common,
      side: 'buy',
      feeRate: config.feeRates[buyBook.venueId] ?? '0',
      ...(config.orderType === 'limit' ? { limitPrice: bestAsk.price } : {}),
    },
    buyBook,
    config.fillModel,
  );
  const sellFill = simulateFill(
    {
      ...common,
      side: 'sell',
      feeRate: config.feeRates[sellBook.venueId] ?? '0',
      ...(config.orderType === 'limit' ? { limitPrice: bestBid.price } : {}),
    },
    sellBook,
    config.fillModel,
  );
  const buyQuantity = new ExactDecimal(buyFill.filledQuantity);
  const sellQuantity = new ExactDecimal(sellFill.filledQuantity);
  if (buyQuantity.isZero() && sellQuantity.isZero()) return undefined;
  const matched = Decimal.min(buyQuantity, sellQuantity);
  const imbalance = buyQuantity.minus(sellQuantity).abs();
  const buyAverage = new ExactDecimal(buyFill.averagePrice ?? '0');
  const sellAverage = new ExactDecimal(sellFill.averagePrice ?? '0');
  const gross = sellAverage.minus(buyAverage).times(matched);
  const fees = new ExactDecimal(buyFill.fee).plus(sellFill.fee);
  const slippage = new ExactDecimal(buyFill.slippageCost).plus(
    sellFill.slippageCost,
  );
  const rebalancing = imbalance
    .times(Decimal.max(buyAverage, sellAverage))
    .times(config.inventoryRebalanceRate);
  const net = gross.minus(fees).minus(rebalancing);
  return {
    observedAt,
    canonicalSymbol: symbol,
    buyVenueId: buyBook.venueId,
    sellVenueId: sellBook.venueId,
    requestedQuantity: config.tradeSize,
    matchedQuantity: canonical(matched),
    inventoryImbalance: canonical(imbalance),
    grossProfit: canonical(gross),
    feeCost: canonical(fees),
    slippageCost: canonical(slippage),
    rebalancingCost: canonical(rebalancing),
    netProfit: canonical(net),
    capitalRequired: canonical(
      new ExactDecimal(buyFill.quoteAmount).plus(buyFill.fee),
    ),
    buyFill,
    sellFill,
  };
}

export async function executeArbitrageBacktest(
  run: BacktestRunView,
  events: readonly ReplayEvent[],
  options: ReplayOptions = {},
): Promise<BacktestExecutionResult> {
  const config = parseBacktestConfig(run.configuration);
  const availability = futureAvailability(events);
  const books = new Map<string, Map<string, ExecutionBook>>();
  const replay = await replayDeterministically(
    events,
    run.seed,
    (event) => {
      if (!event.canonicalSymbol) return undefined;
      const book = asExecutionBook(event, availability.get(event.sourceId));
      if (!book) return undefined;
      const venues =
        books.get(event.canonicalSymbol) ?? new Map<string, ExecutionBook>();
      venues.set(event.venueId, book);
      books.set(event.canonicalSymbol, venues);
      const candidates = [...venues.values()].filter(
        (candidate) => candidate.venueId !== event.venueId,
      );
      const trades = candidates.flatMap((candidate) => [
        trade(
          event.canonicalSymbol!,
          event.receivedAt,
          book,
          candidate,
          config,
        ),
        trade(
          event.canonicalSymbol!,
          event.receivedAt,
          candidate,
          book,
          config,
        ),
      ]);
      return trades.find((candidate) => candidate !== undefined);
    },
    options,
  );
  return {
    outputHash: replay.outputHash,
    metrics: {
      eventCount: replay.eventCount,
      opportunityCount: replay.outputs.length,
      scenario: config.scenario,
    },
    results: { trades: replay.outputs as unknown as JsonObject['trades'] },
  };
}

import Decimal from 'decimal.js';

const ExactDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1_000_000,
  toExpPos: 1_000_000,
});

export interface DepthLevel {
  price: string;
  quantity: string;
}

/**
 * A normalized, side-resolved order book for one venue. `bids` must be sorted
 * by descending price and `asks` by ascending price. Prices and quantities are
 * exact decimal strings. Fees and trading rules are the effective, venue
 * specific values captured at evaluation time.
 */
export interface ExecutableBookInput {
  eventId: string;
  marketId: string;
  venueId: string;
  sequence: string;
  receivedAt: Date;
  valid: boolean;
  invalidationReason?: string;
  baseCurrency: string;
  quoteCurrency: string;
  bids: readonly DepthLevel[];
  asks: readonly DepthLevel[];
  takerFee: string;
  priceIncrement: string;
  quantityIncrement: string;
  minimumQuantity?: string;
  maximumQuantity?: string;
  minimumNotional?: string;
}

/**
 * Configured inventory per venue. A venue absent from the map is treated as
 * unconstrained (research convenience). A venue that is present enforces every
 * currency it lists; a currency missing from a present venue is treated as a
 * zero balance.
 */
export type InventoryConfig = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

export interface ExecutableDetectorConfig {
  id: string;
  version: string;
  maximumBookAgeMs: number;
  maximumCrossVenueSkewMs: number;
  /** Base-asset quantities to evaluate. Must be positive exact decimals. */
  tradeSizes: readonly string[];
  /** Symmetric safety haircut applied to both legs, as a rate (e.g. '0.0005'). */
  slippageBufferRate: string;
  /** Recorded for latency studies; does not gate classification here. */
  latencyBufferMs: number;
  /** Net-profit rate (net profit / buy notional) required to be executable. */
  minimumNetProfitRate: string;
  inventory: InventoryConfig;
}

export type ExecutableRejectionReason =
  'cross_venue_skew' | 'invalid_book' | 'missing_quote' | 'stale_book';

export type SizeBlockReason =
  | 'above_max_quantity'
  | 'below_min_notional'
  | 'below_min_quantity'
  | 'insufficient_depth'
  | 'insufficient_inventory';

export interface SizeEvaluation {
  requestedSize: string;
  filledSize: string;
  depthSufficient: boolean;
  vwapBuyPrice?: string;
  vwapSellPrice?: string;
  buyNotional?: string;
  sellNotional?: string;
  grossProfit?: string;
  feeCost?: string;
  slippageCost?: string;
  netProfit?: string;
  netProfitRate?: string;
  profitable: boolean;
  viable: boolean;
  blockReasons: readonly SizeBlockReason[];
}

export interface ExecutableOpportunityResult {
  classification: 'executable' | 'missed' | 'observed' | 'rejected';
  canonicalSymbol: string;
  direction: string;
  buyMarketId: string;
  sellMarketId: string;
  buyBookEventId: string;
  sellBookEventId: string;
  buyVenueId: string;
  sellVenueId: string;
  buyFreshnessMs: number;
  sellFreshnessMs: number;
  crossVenueSkewMs: number;
  buyTakerFee: string;
  sellTakerFee: string;
  /** Top-of-book gross spread ((bestBid - bestAsk) / bestAsk) when quotes exist. */
  topOfBookSpread?: string;
  sizeEvaluations: readonly SizeEvaluation[];
  /** Best qualifying size: the profitable size (viable for executable, blocked for missed). */
  bestSize?: string;
  /** Largest viable and profitable size. Populated only when executable. */
  maxExecutableSize?: string;
  grossProfit?: string;
  feeCost?: string;
  slippageCost?: string;
  netProfit?: string;
  netProfitRate?: string;
  rejectionReason?: ExecutableRejectionReason;
  blockReason?: SizeBlockReason;
}

interface Fill {
  filled: Decimal;
  notional: Decimal;
  sufficient: boolean;
}

function walk(levels: readonly DepthLevel[], target: Decimal): Fill {
  let remaining = target;
  let filled = new ExactDecimal(0);
  let notional = new ExactDecimal(0);
  for (const level of levels) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const available = new ExactDecimal(level.quantity);
    if (available.lessThanOrEqualTo(0)) continue;
    const price = new ExactDecimal(level.price);
    const take = Decimal.min(available, remaining);
    filled = filled.plus(take);
    notional = notional.plus(take.times(price));
    remaining = remaining.minus(take);
  }
  return {
    filled,
    notional,
    sufficient: remaining.lessThanOrEqualTo(0),
  };
}

function canonical(value: Decimal): string {
  const fixed = value.toFixed();
  return fixed === '-0' ? '0' : fixed;
}

export class ExecutableArbitrageDetector {
  readonly #sizes: readonly Decimal[];
  readonly #slippage: Decimal;
  readonly #minimumNetProfitRate: Decimal;

  constructor(readonly config: ExecutableDetectorConfig) {
    if (
      !Number.isFinite(config.maximumBookAgeMs) ||
      config.maximumBookAgeMs < 1 ||
      !Number.isFinite(config.maximumCrossVenueSkewMs) ||
      config.maximumCrossVenueSkewMs < 0 ||
      !Number.isFinite(config.latencyBufferMs) ||
      config.latencyBufferMs < 0
    )
      throw new RangeError('detector timing thresholds are invalid');
    if (config.tradeSizes.length === 0)
      throw new RangeError('at least one trade size is required');
    this.#sizes = config.tradeSizes.map((size) => {
      const parsed = new ExactDecimal(size);
      if (!parsed.isFinite() || !parsed.greaterThan(0))
        throw new RangeError('trade sizes must be positive');
      return parsed;
    });
    this.#slippage = new ExactDecimal(config.slippageBufferRate);
    if (!this.#slippage.isFinite() || this.#slippage.isNegative())
      throw new RangeError('slippage buffer rate must be non-negative');
    this.#minimumNetProfitRate = new ExactDecimal(config.minimumNetProfitRate);
    if (!this.#minimumNetProfitRate.isFinite())
      throw new RangeError('minimum net profit rate must be finite');
  }

  evaluate(
    canonicalSymbol: string,
    buy: ExecutableBookInput,
    sell: ExecutableBookInput,
    evaluatedAt: Date,
  ): ExecutableOpportunityResult {
    const buyFreshnessMs = Math.max(
      0,
      evaluatedAt.getTime() - buy.receivedAt.getTime(),
    );
    const sellFreshnessMs = Math.max(
      0,
      evaluatedAt.getTime() - sell.receivedAt.getTime(),
    );
    const crossVenueSkewMs = Math.abs(
      buy.receivedAt.getTime() - sell.receivedAt.getTime(),
    );
    const base = {
      canonicalSymbol,
      direction: `buy-${buy.venueId.toLowerCase()}-sell-${sell.venueId.toLowerCase()}`,
      buyMarketId: buy.marketId,
      sellMarketId: sell.marketId,
      buyBookEventId: buy.eventId,
      sellBookEventId: sell.eventId,
      buyVenueId: buy.venueId,
      sellVenueId: sell.venueId,
      buyFreshnessMs,
      sellFreshnessMs,
      crossVenueSkewMs,
      buyTakerFee: canonical(new ExactDecimal(buy.takerFee)),
      sellTakerFee: canonical(new ExactDecimal(sell.takerFee)),
      sizeEvaluations: [] as readonly SizeEvaluation[],
    };

    const rejection = this.structuralRejection(
      buy,
      sell,
      buyFreshnessMs,
      sellFreshnessMs,
      crossVenueSkewMs,
    );
    if (rejection)
      return {
        ...base,
        classification: 'rejected',
        rejectionReason: rejection,
      };

    const bestAsk = new ExactDecimal(buy.asks[0]!.price);
    const bestBid = new ExactDecimal(sell.bids[0]!.price);
    const topOfBookSpread = canonical(
      bestBid.minus(bestAsk).dividedBy(bestAsk),
    );

    const buyTaker = new ExactDecimal(buy.takerFee);
    const sellTaker = new ExactDecimal(sell.takerFee);
    const evaluations = this.#sizes.map((size) =>
      this.evaluateSize(size, buy, sell, buyTaker, sellTaker),
    );

    const withBase = { ...base, topOfBookSpread, sizeEvaluations: evaluations };

    const executable = evaluations.filter(
      (evaluation) => evaluation.viable && evaluation.profitable,
    );
    if (executable.length > 0) {
      const best = executable.reduce((left, right) =>
        new ExactDecimal(right.netProfit!).greaterThan(left.netProfit!)
          ? right
          : left,
      );
      const maxSize = executable.reduce((left, right) =>
        new ExactDecimal(right.requestedSize).greaterThan(left.requestedSize)
          ? right
          : left,
      );
      return {
        ...withBase,
        classification: 'executable',
        bestSize: best.requestedSize,
        maxExecutableSize: maxSize.requestedSize,
        grossProfit: best.grossProfit,
        feeCost: best.feeCost,
        slippageCost: best.slippageCost,
        netProfit: best.netProfit,
        netProfitRate: best.netProfitRate,
      };
    }

    const missed = evaluations.filter(
      (evaluation) =>
        !evaluation.viable &&
        evaluation.profitable &&
        evaluation.depthSufficient,
    );
    if (missed.length > 0) {
      const best = missed.reduce((left, right) =>
        new ExactDecimal(right.netProfit!).greaterThan(left.netProfit!)
          ? right
          : left,
      );
      return {
        ...withBase,
        classification: 'missed',
        bestSize: best.requestedSize,
        blockReason: best.blockReasons[0],
      };
    }

    return { ...withBase, classification: 'observed' };
  }

  private structuralRejection(
    buy: ExecutableBookInput,
    sell: ExecutableBookInput,
    buyFreshnessMs: number,
    sellFreshnessMs: number,
    crossVenueSkewMs: number,
  ): ExecutableRejectionReason | undefined {
    if (!buy.valid || !sell.valid) return 'invalid_book';
    if (!buy.asks[0] || !sell.bids[0]) return 'missing_quote';
    if (
      buyFreshnessMs > this.config.maximumBookAgeMs ||
      sellFreshnessMs > this.config.maximumBookAgeMs
    )
      return 'stale_book';
    if (crossVenueSkewMs > this.config.maximumCrossVenueSkewMs)
      return 'cross_venue_skew';
    return undefined;
  }

  private evaluateSize(
    size: Decimal,
    buy: ExecutableBookInput,
    sell: ExecutableBookInput,
    buyTaker: Decimal,
    sellTaker: Decimal,
  ): SizeEvaluation {
    const requestedSize = canonical(size);
    const buyFill = walk(buy.asks, size);
    const sellFill = walk(sell.bids, size);
    const depthSufficient = buyFill.sufficient && sellFill.sufficient;
    const filledSize = canonical(Decimal.min(buyFill.filled, sellFill.filled));

    if (!depthSufficient) {
      return {
        requestedSize,
        filledSize,
        depthSufficient: false,
        profitable: false,
        viable: false,
        blockReasons: ['insufficient_depth'],
      };
    }

    const buyNotional = buyFill.notional;
    const sellNotional = sellFill.notional;
    const grossProfit = sellNotional.minus(buyNotional);
    const feeCost = buyNotional
      .times(buyTaker)
      .plus(sellNotional.times(sellTaker));
    const slippageCost = buyNotional.plus(sellNotional).times(this.#slippage);
    const netProfit = grossProfit.minus(feeCost).minus(slippageCost);
    const netProfitRate = buyNotional.isZero()
      ? new ExactDecimal(0)
      : netProfit.dividedBy(buyNotional);
    const profitable =
      netProfitRate.greaterThanOrEqualTo(this.#minimumNetProfitRate) &&
      netProfit.greaterThan(0);

    const blockReasons = this.constraints(
      size,
      buy,
      sell,
      buyNotional,
      sellNotional,
    );

    return {
      requestedSize,
      filledSize,
      depthSufficient: true,
      vwapBuyPrice: canonical(buyNotional.dividedBy(size)),
      vwapSellPrice: canonical(sellNotional.dividedBy(size)),
      buyNotional: canonical(buyNotional),
      sellNotional: canonical(sellNotional),
      grossProfit: canonical(grossProfit),
      feeCost: canonical(feeCost),
      slippageCost: canonical(slippageCost),
      netProfit: canonical(netProfit),
      netProfitRate: canonical(netProfitRate),
      profitable,
      viable: blockReasons.length === 0,
      blockReasons,
    };
  }

  private constraints(
    size: Decimal,
    buy: ExecutableBookInput,
    sell: ExecutableBookInput,
    buyNotional: Decimal,
    sellNotional: Decimal,
  ): SizeBlockReason[] {
    const reasons: SizeBlockReason[] = [];
    for (const venue of [buy, sell]) {
      if (venue.minimumQuantity && size.lessThan(venue.minimumQuantity)) {
        reasons.push('below_min_quantity');
        break;
      }
    }
    for (const venue of [buy, sell]) {
      if (venue.maximumQuantity && size.greaterThan(venue.maximumQuantity)) {
        reasons.push('above_max_quantity');
        break;
      }
    }
    if (
      (buy.minimumNotional && buyNotional.lessThan(buy.minimumNotional)) ||
      (sell.minimumNotional && sellNotional.lessThan(sell.minimumNotional))
    )
      reasons.push('below_min_notional');

    // Buy leg spends quote on the buy venue including fees and the safety
    // buffer; sell leg must hold `size` of base on the sell venue.
    const requiredQuote = buyNotional
      .plus(buyNotional.times(new ExactDecimal(buy.takerFee)))
      .plus(buyNotional.plus(sellNotional).times(this.#slippage));
    if (
      !this.hasInventory(buy.venueId, buy.quoteCurrency, requiredQuote) ||
      !this.hasInventory(sell.venueId, sell.baseCurrency, size)
    )
      reasons.push('insufficient_inventory');
    return reasons;
  }

  private hasInventory(
    venueId: string,
    currency: string,
    required: Decimal,
  ): boolean {
    const venue = this.config.inventory[venueId];
    if (!venue) return true;
    const available = venue[currency];
    if (available === undefined) return required.lessThanOrEqualTo(0);
    return new ExactDecimal(available).greaterThanOrEqualTo(required);
  }
}

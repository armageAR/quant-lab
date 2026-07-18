import Decimal from 'decimal.js';

const ExactDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_EVEN,
});

export interface ObservedDetectorConfig {
  id: string;
  version: string;
  maximumBookAgeMs: number;
  maximumCrossVenueSkewMs: number;
  minimumObservedSpread: string;
}

export interface ObservedBookInput {
  eventId: string;
  marketId: string;
  venueId: string;
  sequence: string;
  receivedAt: Date;
  valid: boolean;
  invalidationReason?: string;
  bestBid?: string;
  bestAsk?: string;
}

export interface ObservedOpportunityResult {
  classification: 'observed' | 'rejected';
  canonicalSymbol: string;
  direction: string;
  buyMarketId: string;
  sellMarketId: string;
  buyBookEventId: string;
  sellBookEventId: string;
  buyPrice?: string;
  sellPrice?: string;
  observedSpread?: string;
  buyFreshnessMs: number;
  sellFreshnessMs: number;
  crossVenueSkewMs: number;
  rejectionReason?:
    | 'below_threshold'
    | 'cross_venue_skew'
    | 'invalid_book'
    | 'missing_quote'
    | 'stale_book';
}

export class ObservedArbitrageDetector {
  constructor(readonly config: ObservedDetectorConfig) {
    if (config.maximumBookAgeMs < 1 || config.maximumCrossVenueSkewMs < 0)
      throw new RangeError('detector timing thresholds are invalid');
    new ExactDecimal(config.minimumObservedSpread);
  }

  evaluate(
    canonicalSymbol: string,
    buy: ObservedBookInput,
    sell: ObservedBookInput,
    evaluatedAt: Date,
  ): ObservedOpportunityResult {
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
      buyFreshnessMs,
      sellFreshnessMs,
      crossVenueSkewMs,
    };
    if (!buy.valid || !sell.valid)
      return {
        ...base,
        classification: 'rejected',
        rejectionReason: 'invalid_book',
      };
    if (!buy.bestAsk || !sell.bestBid)
      return {
        ...base,
        classification: 'rejected',
        rejectionReason: 'missing_quote',
      };
    if (
      buyFreshnessMs > this.config.maximumBookAgeMs ||
      sellFreshnessMs > this.config.maximumBookAgeMs
    )
      return {
        ...base,
        classification: 'rejected',
        rejectionReason: 'stale_book',
      };
    if (crossVenueSkewMs > this.config.maximumCrossVenueSkewMs)
      return {
        ...base,
        classification: 'rejected',
        rejectionReason: 'cross_venue_skew',
      };
    const buyPrice = new ExactDecimal(buy.bestAsk);
    const sellPrice = new ExactDecimal(sell.bestBid);
    const observedSpread = sellPrice.minus(buyPrice).dividedBy(buyPrice);
    const values = {
      ...base,
      buyPrice: buyPrice.toFixed(),
      sellPrice: sellPrice.toFixed(),
      observedSpread: observedSpread.toFixed(),
    };
    if (observedSpread.lessThan(this.config.minimumObservedSpread))
      return {
        ...values,
        classification: 'rejected',
        rejectionReason: 'below_threshold',
      };
    return { ...values, classification: 'observed' };
  }
}

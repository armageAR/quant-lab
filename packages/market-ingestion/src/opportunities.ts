import type { DatabaseClient } from '@quant-lab/database';
import {
  ObservedArbitrageDetector,
  type ObservedBookInput,
  type ObservedDetectorConfig,
  type ObservedOpportunityResult,
} from '@quant-lab/strategy-engine';
import { createHash } from 'node:crypto';

import { MarketEventStore } from './store';

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface OpportunityQuery {
  canonicalSymbol?: string;
  classification?: 'observed' | 'rejected';
  rejectionReason?: string;
  limit?: number;
  cursor?: string;
}

export class ObservedOpportunityService {
  readonly #store: MarketEventStore;

  constructor(private readonly database: DatabaseClient) {
    this.#store = new MarketEventStore(database);
  }

  async evaluateAll(
    config: ObservedDetectorConfig,
    evaluatedAt = new Date(),
    canonicalSymbols?: readonly string[],
  ) {
    const configuration = await this.configuration(config);
    const instruments = await this.database.instrument.findMany({
      where: {
        ...(canonicalSymbols
          ? { canonicalSymbol: { in: [...canonicalSymbols] } }
          : {}),
        markets: {
          some: {
            venueId: { in: ['BINANCE', 'KRAKEN'] },
            status: 'active',
            spot: true,
          },
        },
      },
      include: {
        markets: {
          where: {
            venueId: { in: ['BINANCE', 'KRAKEN'] },
            status: 'active',
            spot: true,
          },
          orderBy: { venueId: 'asc' },
        },
      },
    });
    const detector = new ObservedArbitrageDetector(config);
    const results: ObservedOpportunityResult[] = [];
    for (const instrument of instruments) {
      const binance = instrument.markets.find(
        (market) => market.venueId === 'BINANCE',
      );
      const kraken = instrument.markets.find(
        (market) => market.venueId === 'KRAKEN',
      );
      if (!binance || !kraken) continue;
      const [binanceBook, krakenBook] = await Promise.all([
        this.input(binance.id, evaluatedAt),
        this.input(kraken.id, evaluatedAt),
      ]);
      if (!binanceBook || !krakenBook) continue;
      for (const [buy, sell] of [
        [binanceBook, krakenBook],
        [krakenBook, binanceBook],
      ] as const) {
        const result = detector.evaluate(
          instrument.canonicalSymbol,
          buy,
          sell,
          evaluatedAt,
        );
        await this.persist(configuration.id, result, evaluatedAt);
        results.push(result);
      }
    }
    return results;
  }

  async query(query: OpportunityQuery = {}) {
    const rows = await this.database.observedOpportunity.findMany({
      where: {
        ...(query.canonicalSymbol
          ? { canonicalSymbol: query.canonicalSymbol }
          : {}),
        ...(query.classification
          ? { classification: query.classification }
          : {}),
        ...(query.rejectionReason
          ? { rejectionReason: query.rejectionReason }
          : {}),
      },
      include: { configuration: true },
      orderBy: [{ evaluatedAt: 'desc' }, { id: 'desc' }],
      take: Math.max(1, Math.min(query.limit ?? 100, 500)),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      canonicalSymbol: row.canonicalSymbol,
      classification: row.classification as 'observed' | 'rejected',
      direction: row.direction,
      buyMarketId: row.buyMarketId,
      sellMarketId: row.sellMarketId,
      buyBookEventId: row.buyBookEventId,
      sellBookEventId: row.sellBookEventId,
      ...(row.buyPrice ? { buyPrice: row.buyPrice.toString() } : {}),
      ...(row.sellPrice ? { sellPrice: row.sellPrice.toString() } : {}),
      ...(row.observedSpread
        ? { observedSpread: row.observedSpread.toString() }
        : {}),
      buyFreshnessMs: row.buyFreshnessMs,
      sellFreshnessMs: row.sellFreshnessMs,
      crossVenueSkewMs: row.crossVenueSkewMs,
      ...(row.rejectionReason ? { rejectionReason: row.rejectionReason } : {}),
      evaluatedAt: row.evaluatedAt.toISOString(),
      detector: {
        id: row.configuration.detectorId,
        version: row.configuration.version,
        fingerprint: row.configuration.fingerprint,
      },
    }));
  }

  private async input(
    marketId: string,
    at: Date,
  ): Promise<ObservedBookInput | undefined> {
    const event = await this.database.marketOrderBookEvent.findFirst({
      where: { marketId, processedAt: { lte: at } },
      orderBy: [{ processedAt: 'desc' }, { id: 'desc' }],
    });
    if (!event) return undefined;
    const book = await this.#store.reconstructOrderBook(marketId, at, 1);
    if (!book) return undefined;
    return {
      eventId: event.id,
      marketId,
      venueId: event.venueId,
      sequence: book.sequence,
      receivedAt: event.receivedAt,
      valid: book.valid,
      ...(book.invalidation
        ? { invalidationReason: book.invalidation.reason }
        : {}),
      ...(book.bids[0] ? { bestBid: book.bids[0].price } : {}),
      ...(book.asks[0] ? { bestAsk: book.asks[0].price } : {}),
    };
  }

  private async configuration(config: ObservedDetectorConfig) {
    const fingerprint = hash(stableJson(config));
    const id = `detector_${fingerprint.slice(0, 24)}`;
    return this.database.detectorConfiguration.upsert({
      where: { id },
      update: {},
      create: {
        id,
        detectorId: config.id,
        version: config.version,
        fingerprint,
        configuration: { ...config },
      },
    });
  }

  private async persist(
    configurationId: string,
    result: ObservedOpportunityResult,
    evaluatedAt: Date,
  ) {
    if (
      result.classification !== 'observed' &&
      result.classification !== 'rejected'
    )
      throw new Error(
        'observed detector produced an unsupported classification',
      );
    const idempotencyKey = hash(
      stableJson({
        configurationId,
        direction: result.direction,
        buyBookEventId: result.buyBookEventId,
        sellBookEventId: result.sellBookEventId,
        evaluatedAt: evaluatedAt.toISOString(),
      }),
    );
    await this.database.observedOpportunity.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        idempotencyKey,
        configurationId,
        canonicalSymbol: result.canonicalSymbol,
        classification: result.classification,
        direction: result.direction,
        buyMarketId: result.buyMarketId,
        sellMarketId: result.sellMarketId,
        buyBookEventId: result.buyBookEventId,
        sellBookEventId: result.sellBookEventId,
        buyPrice: result.buyPrice,
        sellPrice: result.sellPrice,
        observedSpread: result.observedSpread,
        buyFreshnessMs: result.buyFreshnessMs,
        sellFreshnessMs: result.sellFreshnessMs,
        crossVenueSkewMs: result.crossVenueSkewMs,
        rejectionReason: result.rejectionReason,
        evaluatedAt,
      },
    });
  }
}

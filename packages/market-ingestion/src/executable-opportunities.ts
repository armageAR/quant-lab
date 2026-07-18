import type { DatabaseClient } from '@quant-lab/database';
import {
  ExecutableArbitrageDetector,
  type ExecutableBookInput,
  type ExecutableDetectorConfig,
  type ExecutableOpportunityResult,
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

export interface ExecutableOpportunityQuery {
  canonicalSymbol?: string;
  classification?: 'executable' | 'missed' | 'observed' | 'rejected';
  rejectionReason?: string;
  limit?: number;
  cursor?: string;
}

export interface ExecutableOpportunityRecord {
  id: string;
  canonicalSymbol: string;
  classification: 'executable' | 'missed' | 'observed' | 'rejected';
  direction: string;
  buyMarketId: string;
  sellMarketId: string;
  buyVenueId: string;
  sellVenueId: string;
  buyBookEventId: string;
  sellBookEventId: string;
  buyTakerFee: string;
  sellTakerFee: string;
  topOfBookSpread?: string;
  bestSize?: string;
  maxExecutableSize?: string;
  grossProfit?: string;
  feeCost?: string;
  slippageCost?: string;
  netProfit?: string;
  netProfitRate?: string;
  sizeEvaluations: unknown;
  buyFreshnessMs: number;
  sellFreshnessMs: number;
  crossVenueSkewMs: number;
  rejectionReason?: string;
  blockReason?: string;
  evaluatedAt: string;
  detector: { id: string; version: string; fingerprint: string };
}

interface MarketBookContext {
  input: ExecutableBookInput;
}

export class ExecutableOpportunityService {
  readonly #store: MarketEventStore;

  constructor(
    private readonly database: DatabaseClient,
    private readonly depth = 100,
  ) {
    this.#store = new MarketEventStore(database);
  }

  async evaluateAll(
    config: ExecutableDetectorConfig,
    evaluatedAt = new Date(),
  ): Promise<readonly ExecutableOpportunityResult[]> {
    const configuration = await this.configuration(config);
    const instruments = await this.database.instrument.findMany({
      where: {
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
    const detector = new ExecutableArbitrageDetector(config);
    const results: ExecutableOpportunityResult[] = [];
    for (const instrument of instruments) {
      const binance = instrument.markets.find(
        (market) => market.venueId === 'BINANCE',
      );
      const kraken = instrument.markets.find(
        (market) => market.venueId === 'KRAKEN',
      );
      if (!binance || !kraken) continue;
      const [binanceBook, krakenBook] = await Promise.all([
        this.context(
          binance.id,
          binance.venueId,
          instrument.baseCurrency,
          instrument.quoteCurrency,
          evaluatedAt,
        ),
        this.context(
          kraken.id,
          kraken.venueId,
          instrument.baseCurrency,
          instrument.quoteCurrency,
          evaluatedAt,
        ),
      ]);
      if (!binanceBook || !krakenBook) continue;
      for (const [buy, sell] of [
        [binanceBook, krakenBook],
        [krakenBook, binanceBook],
      ] as const) {
        const result = detector.evaluate(
          instrument.canonicalSymbol,
          buy.input,
          sell.input,
          evaluatedAt,
        );
        await this.persist(configuration.id, result, evaluatedAt);
        results.push(result);
      }
    }
    return results;
  }

  async query(
    query: ExecutableOpportunityQuery = {},
  ): Promise<readonly ExecutableOpportunityRecord[]> {
    const rows = await this.database.executableOpportunity.findMany({
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
      classification: row.classification as
        'executable' | 'missed' | 'observed' | 'rejected',
      direction: row.direction,
      buyMarketId: row.buyMarketId,
      sellMarketId: row.sellMarketId,
      buyVenueId: row.buyVenueId,
      sellVenueId: row.sellVenueId,
      buyBookEventId: row.buyBookEventId,
      sellBookEventId: row.sellBookEventId,
      buyTakerFee: row.buyTakerFee.toString(),
      sellTakerFee: row.sellTakerFee.toString(),
      ...(row.topOfBookSpread
        ? { topOfBookSpread: row.topOfBookSpread.toString() }
        : {}),
      ...(row.bestSize ? { bestSize: row.bestSize.toString() } : {}),
      ...(row.maxExecutableSize
        ? { maxExecutableSize: row.maxExecutableSize.toString() }
        : {}),
      ...(row.grossProfit ? { grossProfit: row.grossProfit.toString() } : {}),
      ...(row.feeCost ? { feeCost: row.feeCost.toString() } : {}),
      ...(row.slippageCost
        ? { slippageCost: row.slippageCost.toString() }
        : {}),
      ...(row.netProfit ? { netProfit: row.netProfit.toString() } : {}),
      ...(row.netProfitRate
        ? { netProfitRate: row.netProfitRate.toString() }
        : {}),
      sizeEvaluations: row.sizeEvaluations,
      buyFreshnessMs: row.buyFreshnessMs,
      sellFreshnessMs: row.sellFreshnessMs,
      crossVenueSkewMs: row.crossVenueSkewMs,
      ...(row.rejectionReason ? { rejectionReason: row.rejectionReason } : {}),
      ...(row.blockReason ? { blockReason: row.blockReason } : {}),
      evaluatedAt: row.evaluatedAt.toISOString(),
      detector: {
        id: row.configuration.detectorId,
        version: row.configuration.version,
        fingerprint: row.configuration.fingerprint,
      },
    }));
  }

  private async context(
    marketId: string,
    venueId: string,
    baseCurrency: string,
    quoteCurrency: string,
    at: Date,
  ): Promise<MarketBookContext | undefined> {
    const event = await this.database.marketOrderBookEvent.findFirst({
      where: { marketId, processedAt: { lte: at } },
      orderBy: [{ processedAt: 'desc' }, { id: 'desc' }],
    });
    if (!event) return undefined;
    const [book, fee, rule] = await Promise.all([
      this.#store.reconstructOrderBook(marketId, at, this.depth),
      this.database.feeScheduleVersion.findFirst({
        where: { marketId },
        orderBy: { effectiveAt: 'desc' },
      }),
      this.database.tradingRuleVersion.findFirst({
        where: { marketId },
        orderBy: { effectiveAt: 'desc' },
      }),
    ]);
    // Executable evaluation is only meaningful with depth, fees, and rules.
    if (!book || !fee || !rule) return undefined;
    return {
      input: {
        eventId: event.id,
        marketId,
        venueId,
        sequence: book.sequence,
        receivedAt: event.receivedAt,
        valid: book.valid,
        ...(book.invalidation
          ? { invalidationReason: book.invalidation.reason }
          : {}),
        baseCurrency,
        quoteCurrency,
        bids: book.bids.map((level) => ({
          price: level.price,
          quantity: level.quantity,
        })),
        asks: book.asks.map((level) => ({
          price: level.price,
          quantity: level.quantity,
        })),
        takerFee: fee.taker.toString(),
        priceIncrement: rule.priceIncrement.toString(),
        quantityIncrement: rule.quantityIncrement.toString(),
        ...(rule.minimumQuantity
          ? { minimumQuantity: rule.minimumQuantity.toString() }
          : {}),
        ...(rule.maximumQuantity
          ? { maximumQuantity: rule.maximumQuantity.toString() }
          : {}),
        ...(rule.minimumNotional
          ? { minimumNotional: rule.minimumNotional.toString() }
          : {}),
      },
    };
  }

  private async configuration(config: ExecutableDetectorConfig) {
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
    result: ExecutableOpportunityResult,
    evaluatedAt: Date,
  ) {
    if (
      result.classification !== 'executable' &&
      result.classification !== 'missed' &&
      result.classification !== 'observed' &&
      result.classification !== 'rejected'
    )
      throw new Error(
        'executable detector produced an unsupported classification',
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
    await this.database.executableOpportunity.upsert({
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
        buyVenueId: result.buyVenueId,
        sellVenueId: result.sellVenueId,
        buyBookEventId: result.buyBookEventId,
        sellBookEventId: result.sellBookEventId,
        buyTakerFee: result.buyTakerFee,
        sellTakerFee: result.sellTakerFee,
        topOfBookSpread: result.topOfBookSpread,
        bestSize: result.bestSize,
        maxExecutableSize: result.maxExecutableSize,
        grossProfit: result.grossProfit,
        feeCost: result.feeCost,
        slippageCost: result.slippageCost,
        netProfit: result.netProfit,
        netProfitRate: result.netProfitRate,
        sizeEvaluations: JSON.parse(
          JSON.stringify(result.sizeEvaluations),
        ) as object[],
        buyFreshnessMs: result.buyFreshnessMs,
        sellFreshnessMs: result.sellFreshnessMs,
        crossVenueSkewMs: result.crossVenueSkewMs,
        rejectionReason: result.rejectionReason,
        blockReason: result.blockReason,
        evaluatedAt,
      },
    });
  }
}

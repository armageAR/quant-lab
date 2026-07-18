import {
  eventTimepoint,
  Price,
  Quantity,
  SourceTimestamp,
} from '@quant-lab/core';
import type { DatabaseClient } from '@quant-lab/database';
import type {
  Candle,
  ClockDriftSample,
  OrderBook,
  Ticker,
  Trade,
} from '@quant-lab/market-data';
import type { ApplicationMetrics } from '@quant-lab/shared';
import { createHash } from 'node:crypto';

import { OrderBookEngine, type ReconstructedBook } from './order-book';

function date(value: SourceTimestamp): Date {
  return new Date(Number(value.epochMicroseconds / 1_000n));
}

function key(type: string, identity: string): string {
  return createHash('sha256').update(`${type}:${identity}`).digest('hex');
}

function times(event: Ticker | Trade) {
  return {
    eventTime: event.time.eventTime ? date(event.time.eventTime) : null,
    receivedAt: date(event.time.receivedAt),
    processedAt: date(event.time.processedAt),
  };
}

export class MarketEventStore {
  constructor(
    private readonly database: DatabaseClient,
    private readonly metrics?: ApplicationMetrics,
  ) {}

  async storeTicker(event: Ticker): Promise<boolean> {
    const identity = `${event.marketId}:${event.time.eventTime?.epochMicroseconds ?? event.time.receivedAt.epochMicroseconds}`;
    return this.database.$transaction(async (tx) => {
      const idempotencyKey = key('ticker', identity);
      if (await tx.marketTicker.findUnique({ where: { idempotencyKey } })) {
        this.metrics?.ingestionDuplicates.inc({
          venue: event.venueId,
          type: 'ticker',
        });
        return false;
      }
      const payload = {
        bid: event.bid?.toString(),
        bidQuantity: event.bidQuantity?.toString(),
        ask: event.ask?.toString(),
        askQuantity: event.askQuantity?.toString(),
        last: event.last?.toString(),
      };
      const sourcePayload = event.sourcePayload ?? payload;
      const raw = await tx.rawMarketEnvelope.create({
        data: {
          idempotencyKey,
          venueId: event.venueId,
          marketId: event.marketId,
          eventType: 'ticker',
          ...times(event),
          sourcePrecision:
            event.time.eventTime?.precision ?? event.time.receivedAt.precision,
          payload: sourcePayload,
          checksum: key('payload', JSON.stringify(sourcePayload)),
        },
      });
      await tx.marketTicker.create({
        data: {
          idempotencyKey,
          marketId: event.marketId,
          ...times(event),
          bid: event.bid?.toString(),
          bidQuantity: event.bidQuantity?.toString(),
          ask: event.ask?.toString(),
          askQuantity: event.askQuantity?.toString(),
          last: event.last?.toString(),
          rawEnvelopeId: raw.id,
        },
      });
      this.metrics?.ingestedEvents.inc({
        venue: event.venueId,
        type: 'ticker',
      });
      if (event.time.eventTime)
        this.metrics?.ingestionLag.observe(
          { venue: event.venueId, type: 'ticker' },
          Number(
            event.time.receivedAt.epochMicroseconds -
              event.time.eventTime.epochMicroseconds,
          ) / 1_000_000,
        );
      return true;
    });
  }

  async storeClockDrift(sample: ClockDriftSample): Promise<void> {
    await this.database.clockDriftMeasurement.create({
      data: {
        venueId: sample.venueId,
        sampledAt: date(sample.sampledAt),
        serverTime: date(sample.serverTime),
        driftMicroseconds: BigInt(sample.driftMicroseconds),
        roundTripMicroseconds: BigInt(sample.roundTripMicroseconds),
      },
    });
  }

  async storeTrades(events: readonly Trade[]): Promise<number> {
    return this.database.$transaction(async (tx) => {
      let inserted = 0;
      for (const event of events.slice(0, 1000)) {
        const idempotencyKey = key(
          'trade',
          `${event.marketId}:${event.tradeId}`,
        );
        if (
          await tx.marketTrade.findUnique({
            where: { idempotencyKey },
          })
        ) {
          this.metrics?.ingestionDuplicates.inc({
            venue: event.venueId,
            type: 'trade',
          });
          continue;
        }
        const payload = {
          tradeId: event.tradeId,
          side: event.side,
          price: event.price.toString(),
          quantity: event.quantity.toString(),
        };
        const sourcePayload = event.sourcePayload ?? payload;
        const raw = await tx.rawMarketEnvelope.create({
          data: {
            idempotencyKey,
            venueId: event.venueId,
            marketId: event.marketId,
            eventType: 'trade',
            ...times(event),
            sourcePrecision:
              event.time.eventTime?.precision ??
              event.time.receivedAt.precision,
            payload: sourcePayload,
            checksum: key('payload', JSON.stringify(sourcePayload)),
          },
        });
        await tx.marketTrade.create({
          data: {
            idempotencyKey,
            marketId: event.marketId,
            venueTradeId: event.tradeId,
            side: event.side,
            price: event.price.toString(),
            quantity: event.quantity.toString(),
            ...times(event),
            rawEnvelopeId: raw.id,
          },
        });
        this.metrics?.ingestedEvents.inc({
          venue: event.venueId,
          type: 'trade',
        });
        inserted++;
      }
      return inserted;
    });
  }

  async storeCandles(events: readonly Candle[]): Promise<number> {
    let inserted = 0;
    for (const event of events) {
      const idempotencyKey = key(
        'candle',
        `${event.marketId}:${event.interval}:${event.openedAt.epochMicroseconds}`,
      );
      if (
        await this.database.marketCandle.findUnique({
          where: { idempotencyKey },
        })
      ) {
        this.metrics?.ingestionDuplicates.inc({
          venue: event.venueId,
          type: 'candle',
        });
        continue;
      }
      const receivedAt = date(event.time.receivedAt);
      const processedAt = date(event.time.processedAt);
      await this.database.$transaction(async (tx) => {
        const payload = {
          interval: event.interval,
          open: event.open.toString(),
          high: event.high.toString(),
          low: event.low.toString(),
          close: event.close.toString(),
          volume: event.volume.toString(),
        };
        const sourcePayload = event.sourcePayload ?? payload;
        const raw = await tx.rawMarketEnvelope.create({
          data: {
            idempotencyKey,
            venueId: event.venueId,
            marketId: event.marketId,
            eventType: 'candle',
            eventTime: date(event.openedAt),
            receivedAt,
            processedAt,
            sourcePrecision: event.openedAt.precision,
            payload: sourcePayload,
            checksum: key('payload', JSON.stringify(sourcePayload)),
          },
        });
        await tx.marketCandle.create({
          data: {
            idempotencyKey,
            marketId: event.marketId,
            interval: event.interval,
            openedAt: date(event.openedAt),
            closedAt: date(event.closedAt),
            open: event.open.toString(),
            high: event.high.toString(),
            low: event.low.toString(),
            close: event.close.toString(),
            volume: event.volume.toString(),
            tradeCount: event.tradeCount,
            receivedAt,
            processedAt,
            rawEnvelopeId: raw.id,
          },
        });
      });
      this.metrics?.ingestedEvents.inc({
        venue: event.venueId,
        type: 'candle',
      });
      inserted++;
    }
    return inserted;
  }

  async storeOrderBook(event: OrderBook): Promise<boolean> {
    const idempotencyKey = key(
      'order-book',
      `${event.marketId}:${event.kind}:${event.sequence}`,
    );
    return this.database.$transaction(async (tx) => {
      if (
        await tx.marketOrderBookEvent.findUnique({ where: { idempotencyKey } })
      ) {
        this.metrics?.ingestionDuplicates.inc({
          venue: event.venueId,
          type: 'order_book',
        });
        return false;
      }
      const levels = (items: typeof event.bids) =>
        items.map((level) => ({
          price: level.price.toString(),
          quantity: level.quantity.toString(),
        }));
      const payload = {
        kind: event.kind,
        sequence: event.sequence,
        previousSequence: event.previousSequence,
        bids: levels(event.bids),
        asks: levels(event.asks),
        checksum: event.checksum,
      };
      const raw = await tx.rawMarketEnvelope.create({
        data: {
          idempotencyKey,
          venueId: event.venueId,
          marketId: event.marketId,
          eventType: `order_book_${event.kind}`,
          ...times(event),
          sourcePrecision:
            event.time.eventTime?.precision ?? event.time.receivedAt.precision,
          payload: event.sourcePayload ?? payload,
          checksum: key(
            'payload',
            JSON.stringify(event.sourcePayload ?? payload),
          ),
        },
      });
      await tx.marketOrderBookEvent.create({
        data: {
          idempotencyKey,
          marketId: event.marketId,
          venueId: event.venueId,
          kind: event.kind,
          sequence: event.sequence,
          previousSequence: event.previousSequence,
          ...times(event),
          bids: levels(event.bids),
          asks: levels(event.asks),
          checksum: event.checksum,
          depth: Math.max(event.bids.length, event.asks.length),
          rawEnvelopeId: raw.id,
        },
      });
      this.metrics?.ingestedEvents.inc({
        venue: event.venueId,
        type: 'order_book',
      });
      return true;
    });
  }

  async recordBookInvalidation(
    marketId: string,
    venueId: string,
    reason: string,
    sequence?: string,
    details?: Record<string, string>,
  ): Promise<void> {
    await this.database.orderBookInvalidation.create({
      data: {
        marketId,
        venueId,
        reason,
        sequence,
        details,
        detectedAt: new Date(),
      },
    });
  }

  async reconstructOrderBook(
    marketId: string,
    at = new Date(),
    depth = 100,
  ): Promise<ReconstructedBook | undefined> {
    const snapshot = await this.database.marketOrderBookEvent.findFirst({
      where: { marketId, kind: 'snapshot', processedAt: { lte: at } },
      orderBy: [{ processedAt: 'desc' }, { id: 'desc' }],
    });
    if (!snapshot) return undefined;
    const deltas = await this.database.marketOrderBookEvent.findMany({
      where: {
        marketId,
        kind: 'delta',
        processedAt: { gte: snapshot.processedAt, lte: at },
      },
      orderBy: [{ processedAt: 'asc' }, { id: 'asc' }],
      take: 10_000,
    });
    deltas.sort((left, right) => {
      if (/^\d+$/.test(left.sequence) && /^\d+$/.test(right.sequence)) {
        const difference = BigInt(left.sequence) - BigInt(right.sequence);
        return difference < 0n ? -1 : difference > 0n ? 1 : 0;
      }
      return left.processedAt.getTime() - right.processedAt.getTime();
    });
    const engine = new OrderBookEngine({
      depth,
      staleAfterMs: Number.MAX_SAFE_INTEGER,
    });
    let result: ReconstructedBook | undefined;
    for (const row of [snapshot, ...deltas]) {
      const timestamp = SourceTimestamp.fromEpochMicroseconds(
        BigInt(row.processedAt.getTime()) * 1_000n,
      );
      const level = (side: 'bid' | 'ask', value: unknown) =>
        (value as Array<{ price: string; quantity: string }>).map((item) => ({
          side,
          price: Price.from(item.price, marketId),
          quantity: Quantity.from(item.quantity, marketId),
        }));
      result = engine.apply({
        venueId: row.venueId,
        marketId: row.marketId,
        source: 'persistence',
        kind: row.kind as 'snapshot' | 'delta',
        sequence: row.sequence,
        ...(row.previousSequence
          ? { previousSequence: row.previousSequence }
          : {}),
        ...(row.checksum ? { checksum: row.checksum } : {}),
        bids: level('bid', row.bids),
        asks: level('ask', row.asks),
        time: eventTimepoint({ receivedAt: timestamp, processedAt: timestamp }),
      });
      if (!result.valid) break;
    }
    return result;
  }

  async trades(
    marketId: string,
    limit = 100,
    cursor?: string,
  ): Promise<readonly StoredTrade[]> {
    const bounded = Math.max(1, Math.min(limit, 500));
    const rows = await this.database.marketTrade.findMany({
      where: { marketId },
      orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
      take: bounded,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      marketId: row.marketId,
      tradeId: row.venueTradeId,
      side: row.side,
      price: row.price.toString(),
      quantity: row.quantity.toString(),
      eventTime: row.eventTime?.toISOString(),
    }));
  }

  async tradesByCanonical(
    canonicalSymbol: string,
    from?: Date,
    to?: Date,
    limit = 100,
    cursor?: string,
  ): Promise<readonly StoredTrade[]> {
    const rows = await this.database.marketTrade.findMany({
      where: {
        market: { instrument: { canonicalSymbol } },
        ...(from || to
          ? {
              eventTime: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
      take: Math.max(1, Math.min(limit, 500)),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      marketId: row.marketId,
      tradeId: row.venueTradeId,
      side: row.side,
      price: row.price.toString(),
      quantity: row.quantity.toString(),
      eventTime: row.eventTime?.toISOString(),
    }));
  }

  async tickers(
    marketId: string,
    limit = 100,
    cursor?: string,
  ): Promise<readonly StoredTicker[]> {
    const rows = await this.database.marketTicker.findMany({
      where: { marketId },
      orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
      take: Math.max(1, Math.min(limit, 500)),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      marketId: row.marketId,
      bid: row.bid?.toString(),
      ask: row.ask?.toString(),
      last: row.last?.toString(),
      eventTime: row.eventTime?.toISOString(),
    }));
  }

  async tickersByCanonical(
    canonicalSymbol: string,
    from?: Date,
    to?: Date,
    limit = 100,
    cursor?: string,
  ): Promise<readonly StoredTicker[]> {
    const rows = await this.database.marketTicker.findMany({
      where: {
        market: { instrument: { canonicalSymbol } },
        ...(from || to
          ? {
              eventTime: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ eventTime: 'desc' }, { id: 'desc' }],
      take: Math.max(1, Math.min(limit, 500)),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      marketId: row.marketId,
      bid: row.bid?.toString(),
      ask: row.ask?.toString(),
      last: row.last?.toString(),
      eventTime: row.eventTime?.toISOString(),
    }));
  }

  async candles(
    marketId: string,
    interval: string,
    limit = 100,
    cursor?: string,
  ): Promise<readonly StoredCandle[]> {
    const rows = await this.database.marketCandle.findMany({
      where: { marketId, interval },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      take: Math.max(1, Math.min(limit, 500)),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      marketId: row.marketId,
      interval: row.interval,
      openedAt: row.openedAt.toISOString(),
      open: row.open.toString(),
      high: row.high.toString(),
      low: row.low.toString(),
      close: row.close.toString(),
      volume: row.volume.toString(),
    }));
  }

  async candlesByCanonical(
    canonicalSymbol: string,
    interval: string,
    from?: Date,
    to?: Date,
    limit = 100,
    cursor?: string,
  ): Promise<readonly StoredCandle[]> {
    const rows = await this.database.marketCandle.findMany({
      where: {
        interval,
        market: { instrument: { canonicalSymbol } },
        ...(from || to
          ? {
              openedAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      take: Math.max(1, Math.min(limit, 500)),
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      marketId: row.marketId,
      interval: row.interval,
      openedAt: row.openedAt.toISOString(),
      open: row.open.toString(),
      high: row.high.toString(),
      low: row.low.toString(),
      close: row.close.toString(),
      volume: row.volume.toString(),
    }));
  }

  async retainBefore(cutoff: Date): Promise<{
    tickers: number;
    trades: number;
    candles: number;
    orderBooks: number;
    bookInvalidations: number;
    envelopes: number;
  }> {
    return this.database.$transaction(async (tx) => {
      const protectedEvents = await tx.datasetEvent.findMany({
        where: { manifest: { pinnedAt: { not: null } } },
        select: { eventType: true, sourceId: true },
      });
      const protectedIds = (types: readonly string[]) =>
        protectedEvents
          .filter((event) => types.includes(event.eventType))
          .map((event) => event.sourceId);
      const tickers = (
        await tx.marketTicker.deleteMany({
          where: {
            receivedAt: { lt: cutoff },
            id: { notIn: protectedIds(['ticker']) },
          },
        })
      ).count;
      const trades = (
        await tx.marketTrade.deleteMany({
          where: {
            receivedAt: { lt: cutoff },
            id: { notIn: protectedIds(['trade']) },
          },
        })
      ).count;
      const candles = (
        await tx.marketCandle.deleteMany({
          where: {
            receivedAt: { lt: cutoff },
            id: { notIn: protectedIds(['candle']) },
          },
        })
      ).count;
      const orderBooks = (
        await tx.marketOrderBookEvent.deleteMany({
          where: {
            receivedAt: { lt: cutoff },
            id: {
              notIn: protectedIds(['order_book_snapshot', 'order_book_delta']),
            },
          },
        })
      ).count;
      const bookInvalidations = (
        await tx.orderBookInvalidation.deleteMany({
          where: { detectedAt: { lt: cutoff } },
        })
      ).count;
      const envelopes = (
        await tx.rawMarketEnvelope.deleteMany({
          where: {
            receivedAt: { lt: cutoff },
            id: { notIn: protectedEvents.map((event) => event.sourceId) },
          },
        })
      ).count;
      return {
        tickers,
        trades,
        candles,
        orderBooks,
        bookInvalidations,
        envelopes,
      };
    });
  }
}

export interface StoredTicker {
  id: string;
  marketId: string;
  bid?: string;
  ask?: string;
  last?: string;
  eventTime?: string;
}
export interface StoredCandle {
  id: string;
  marketId: string;
  interval: string;
  openedAt: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface StoredTrade {
  id: string;
  marketId: string;
  tradeId: string;
  side: string;
  price: string;
  quantity: string;
  eventTime?: string;
}

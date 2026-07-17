import {
  eventTimepoint,
  Price,
  Quantity,
  SourceTimestamp,
} from '@quant-lab/core';
import type { DatabaseClient } from '@quant-lab/database';
import type {
  Candle,
  DatasetReference,
  HistoricalCandleQuery,
  HistoricalDataProvider,
  HistoricalQuery,
  OrderBook,
  Trade,
} from '@quant-lab/market-data';

function timestamp(value: Date): SourceTimestamp {
  return SourceTimestamp.fromEpochMicroseconds(
    BigInt(value.getTime()) * 1_000n,
  );
}

export class PostgreSqlHistoricalDataProvider implements HistoricalDataProvider {
  constructor(private readonly database: DatabaseClient) {}

  async queryTrades(query: HistoricalQuery): Promise<readonly Trade[]> {
    const market = await this.market(query.marketId);
    const rows = await this.database.marketTrade.findMany({
      where: { marketId: query.marketId, eventTime: this.range(query) },
      orderBy: [{ eventTime: 'asc' }, { id: 'asc' }],
      take: this.limit(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return rows.map((row) => ({
      venueId: market.venueId,
      marketId: market.id,
      source: 'postgresql',
      tradeId: row.venueTradeId,
      side: row.side as 'buy' | 'sell',
      price: Price.from(row.price.toString(), market.id),
      quantity: Quantity.from(row.quantity.toString(), market.instrumentId),
      time: eventTimepoint({
        ...(row.eventTime ? { eventTime: timestamp(row.eventTime) } : {}),
        receivedAt: timestamp(row.receivedAt),
        processedAt: timestamp(row.processedAt),
      }),
    }));
  }

  async queryCandles(query: HistoricalCandleQuery): Promise<readonly Candle[]> {
    const market = await this.market(query.marketId);
    const rows = await this.database.marketCandle.findMany({
      where: {
        marketId: query.marketId,
        interval: query.interval,
        openedAt: this.range(query),
      },
      orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
      take: this.limit(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    return rows.map((row) => ({
      venueId: market.venueId,
      marketId: market.id,
      source: 'postgresql',
      interval: row.interval,
      openedAt: timestamp(row.openedAt),
      closedAt: timestamp(row.closedAt),
      open: Price.from(row.open.toString(), market.id),
      high: Price.from(row.high.toString(), market.id),
      low: Price.from(row.low.toString(), market.id),
      close: Price.from(row.close.toString(), market.id),
      volume: Quantity.from(row.volume.toString(), market.instrumentId),
      ...(row.tradeCount ? { tradeCount: row.tradeCount } : {}),
      time: eventTimepoint({
        eventTime: timestamp(row.openedAt),
        receivedAt: timestamp(row.receivedAt),
        processedAt: timestamp(row.processedAt),
      }),
    }));
  }

  async queryOrderBooks(query: HistoricalQuery): Promise<readonly OrderBook[]> {
    const market = await this.market(query.marketId);
    const rows = await this.database.marketOrderBookEvent.findMany({
      where: { marketId: query.marketId, eventTime: this.range(query) },
      orderBy: [{ eventTime: 'asc' }, { id: 'asc' }],
      take: this.limit(query.limit),
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
    });
    const levels = (side: 'bid' | 'ask', value: unknown) =>
      (value as Array<{ price: string; quantity: string }>).map((item) => ({
        side,
        price: Price.from(item.price, market.id),
        quantity: Quantity.from(item.quantity, market.instrumentId),
      }));
    return rows.map((row) => ({
      venueId: row.venueId,
      marketId: row.marketId,
      source: 'postgresql',
      kind: row.kind as 'snapshot' | 'delta',
      sequence: row.sequence,
      ...(row.previousSequence
        ? { previousSequence: row.previousSequence }
        : {}),
      ...(row.checksum ? { checksum: row.checksum } : {}),
      bids: levels('bid', row.bids),
      asks: levels('ask', row.asks),
      time: eventTimepoint({
        ...(row.eventTime ? { eventTime: timestamp(row.eventTime) } : {}),
        receivedAt: timestamp(row.receivedAt),
        processedAt: timestamp(row.processedAt),
        sequence: row.sequence,
      }),
    }));
  }

  async getDataset(reference: string): Promise<DatasetReference> {
    const manifest = await this.database.datasetManifest.findUniqueOrThrow({
      where: { id: reference },
    });
    return {
      id: manifest.id,
      version: manifest.schemaVersion,
      checksum: manifest.checksum,
      from: timestamp(manifest.from),
      to: timestamp(manifest.to),
      eventCount: String(manifest.eventCount),
      format: manifest.exportPath ? 'ndjson' : 'postgresql-manifest',
    };
  }

  private async market(marketId: string) {
    return this.database.market.findUniqueOrThrow({ where: { id: marketId } });
  }

  private limit(value?: number): number {
    return Math.max(1, Math.min(value ?? 100, 1000));
  }

  private range(
    query: HistoricalQuery,
  ): { gte?: Date; lte?: Date } | undefined {
    if (!query.from && !query.to) return undefined;
    return {
      ...(query.from
        ? { gte: new Date(Number(query.from.epochMicroseconds / 1_000n)) }
        : {}),
      ...(query.to
        ? { lte: new Date(Number(query.to.epochMicroseconds / 1_000n)) }
        : {}),
    };
  }
}

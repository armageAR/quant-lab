import {
  Price,
  Quantity,
  SourceTimestamp,
  eventTimepoint,
  type Market,
  type Venue,
} from '@quant-lab/core';
import type { ProviderSubscription, Ticker } from '@quant-lab/market-data';
import WebSocket from 'ws';
import type { RawData } from 'ws';

type RecordValue = Record<string, unknown>;
export interface TickerWebSocketStats {
  messages: number;
  reconnects: number;
  gaps: number;
  rejected: number;
}
export interface TickerWebSocketSubscription extends ProviderSubscription {
  readonly stats: TickerWebSocketStats;
}
export interface TickerWebSocketOptions {
  venue: Venue;
  markets: readonly Market[];
  onTicker: (ticker: Ticker) => void | Promise<void>;
  now?: () => SourceTimestamp;
  reconnectMs?: number;
  gapMs?: number;
  maxPending?: number;
  onGap?: () => void;
  onRejected?: () => void;
  url?: string;
}

function record(value: unknown): RecordValue {
  return typeof value === 'object' && value !== null
    ? (value as RecordValue)
    : {};
}
function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function timestamp(value: unknown): SourceTimestamp | undefined {
  if (typeof value !== 'string') return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms)
    ? SourceTimestamp.fromEpochMilliseconds(String(ms), value)
    : undefined;
}
function rawText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}

export class NativeTickerWebSocket implements TickerWebSocketSubscription {
  readonly stats: TickerWebSocketStats = {
    messages: 0,
    reconnects: 0,
    gaps: 0,
    rejected: 0,
  };
  #closed = false;
  #socket?: WebSocket;
  #timer?: NodeJS.Timeout;
  #queue = Promise.resolve();
  #lastMessage?: number;
  #pending = 0;
  constructor(private readonly options: TickerWebSocketOptions) {
    this.connect();
  }
  get closed(): boolean {
    return this.#closed;
  }
  async [Symbol.asyncDispose](): Promise<void> {
    this.#closed = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#socket?.close();
    await this.#queue;
  }
  private connect(): void {
    if (this.#closed) return;
    const binance = this.options.venue.code === 'BINANCE';
    const symbols = this.options.markets.map((m) =>
      m.venueSymbol.replace('/', '').toLowerCase(),
    );
    const url =
      this.options.url ??
      (binance
        ? `wss://stream.binance.com:9443/stream?streams=${symbols.map((s) => `${s}@bookTicker`).join('/')}`
        : 'wss://ws.kraken.com/v2');
    const socket = new WebSocket(url);
    this.#socket = socket;
    socket.on('open', () => {
      if (!binance)
        socket.send(
          JSON.stringify({
            method: 'subscribe',
            params: {
              channel: 'ticker',
              symbol: this.options.markets.map((m) => m.venueSymbol),
              snapshot: true,
            },
          }),
        );
    });
    socket.on('message', (data) => {
      if (this.#pending >= (this.options.maxPending ?? 1000)) {
        this.stats.rejected++;
        this.options.onRejected?.();
        socket.close();
        return;
      }
      this.#pending++;
      this.#queue = this.#queue
        .then(() => this.handle(rawText(data)))
        .catch(() => {
          this.stats.rejected++;
          this.options.onRejected?.();
        })
        .finally(() => {
          this.#pending--;
        });
    });
    socket.on('close', () => this.reconnect());
    socket.on('error', () => socket.close());
  }
  private reconnect(): void {
    if (this.#closed) return;
    this.stats.reconnects++;
    this.#timer = setTimeout(
      () => this.connect(),
      this.options.reconnectMs ?? 1000,
    );
  }
  private async handle(raw: string): Promise<void> {
    const now =
      this.options.now?.() ??
      SourceTimestamp.fromEpochMilliseconds(String(Date.now()));
    const wall = Number(now.epochMicroseconds / 1000n);
    if (
      this.#lastMessage !== undefined &&
      wall - this.#lastMessage > (this.options.gapMs ?? 5000)
    )
      this.stats.gaps++;
    this.options.onGap?.();
    this.#lastMessage = wall;
    const root = record(JSON.parse(raw));
    const binance = this.options.venue.code === 'BINANCE';
    const value = binance
      ? record(root.data)
      : record(Array.isArray(root.data) ? root.data[0] : undefined);
    const venueSymbol = binance ? string(value.s) : string(value.symbol);
    if (!venueSymbol) return;
    const market = this.options.markets.find((m) =>
      binance
        ? m.venueSymbol.replace('/', '').toUpperCase() ===
          venueSymbol.toUpperCase()
        : m.venueSymbol === venueSymbol,
    );
    if (!market) return;
    const bid = string(binance ? value.b : value.bid);
    const ask = string(binance ? value.a : value.ask);
    const last = string(binance ? undefined : value.last);
    const bidQty = string(binance ? value.B : value.bid_qty);
    const askQty = string(binance ? value.A : value.ask_qty);
    const event = binance ? undefined : timestamp(value.timestamp);
    const ticker: Ticker = {
      venueId: this.options.venue.id,
      marketId: market.id,
      source: 'websocket',
      sourcePayload: value,
      time: eventTimepoint({
        ...(event ? { eventTime: event } : {}),
        receivedAt: now,
        processedAt: this.options.now?.() ?? now,
      }),
      ...(bid ? { bid: Price.from(bid, market.id) } : {}),
      ...(ask ? { ask: Price.from(ask, market.id) } : {}),
      ...(last ? { last: Price.from(last, market.id) } : {}),
      ...(bidQty
        ? { bidQuantity: Quantity.from(bidQty, market.instrumentId) }
        : {}),
      ...(askQty
        ? { askQuantity: Quantity.from(askQty, market.instrumentId) }
        : {}),
    };
    await this.options.onTicker(ticker);
    this.stats.messages++;
  }
}

import type { Market, Venue } from '@quant-lab/core';
import { WebSocketServer } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';
import { NativeTickerWebSocket } from './ticker-websocket';

describe('NativeTickerWebSocket', () => {
  let server: WebSocketServer | undefined;
  afterEach(
    () =>
      new Promise<void>(
        (resolve) => server?.close(() => resolve()) ?? resolve(),
      ),
  );
  it('normalizes Binance messages and drains callback before close', async () => {
    server = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('unexpected address');
    const venue: Venue = {
      id: 'BINANCE',
      code: 'BINANCE',
      name: 'Binance',
      kind: 'exchange',
      status: 'active',
    };
    const market: Market = {
      id: 'BINANCE:BTCUSDT',
      venueId: 'BINANCE',
      instrumentId: 'BTC-USDT',
      venueSymbol: 'BTC/USDT',
      status: 'active',
      spot: true,
    };
    const received: unknown[] = [];
    server.once('connection', (socket) =>
      socket.send(
        JSON.stringify({
          data: { s: 'BTCUSDT', b: '100', B: '2', a: '101', A: '3' },
        }),
      ),
    );
    const subscription = new NativeTickerWebSocket({
      venue,
      markets: [market],
      url: `ws://127.0.0.1:${address.port}`,
      onTicker: (ticker) => {
        received.push(ticker);
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await subscription[Symbol.asyncDispose]();
    expect(received).toHaveLength(1);
    expect(subscription.stats.messages).toBe(1);
  });
  it('reconnects after a disconnected socket', async () => {
    server = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('unexpected address');
    const venue: Venue = {
      id: 'BINANCE',
      code: 'BINANCE',
      name: 'Binance',
      kind: 'exchange',
      status: 'active',
    };
    const market: Market = {
      id: 'BINANCE:BTCUSDT',
      venueId: 'BINANCE',
      instrumentId: 'BTC-USDT',
      venueSymbol: 'BTC/USDT',
      status: 'active',
      spot: true,
    };
    let connections = 0;
    server.on('connection', (socket) => {
      connections++;
      if (connections === 1) socket.close();
      else
        socket.send(
          JSON.stringify({ data: { s: 'BTCUSDT', b: '100', a: '101' } }),
        );
    });
    const subscription = new NativeTickerWebSocket({
      venue,
      markets: [market],
      url: `ws://127.0.0.1:${address.port}`,
      reconnectMs: 1,
      onTicker: () => undefined,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await subscription[Symbol.asyncDispose]();
    expect(subscription.stats.reconnects).toBeGreaterThanOrEqual(1);
    expect(subscription.stats.messages).toBe(1);
  });
  it('bounds pending persistence work', async () => {
    server = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('unexpected address');
    const venue: Venue = {
      id: 'BINANCE',
      code: 'BINANCE',
      name: 'Binance',
      kind: 'exchange',
      status: 'active',
    };
    const market: Market = {
      id: 'BINANCE:BTCUSDT',
      venueId: 'BINANCE',
      instrumentId: 'BTC-USDT',
      venueSymbol: 'BTC/USDT',
      status: 'active',
      spot: true,
    };
    server.on('connection', (socket) => {
      for (let index = 0; index < 5; index++)
        socket.send(
          JSON.stringify({ data: { s: 'BTCUSDT', b: '100', a: '101' } }),
        );
    });
    const subscription = new NativeTickerWebSocket({
      venue,
      markets: [market],
      url: `ws://127.0.0.1:${address.port}`,
      maxPending: 1,
      reconnectMs: 1000,
      onTicker: () => new Promise((resolve) => setTimeout(resolve, 30)),
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await subscription[Symbol.asyncDispose]();
    expect(subscription.stats.rejected).toBeGreaterThan(0);
  });
});

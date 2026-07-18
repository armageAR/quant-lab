import { describe, expect, it } from 'vitest';

import {
  simulateFill,
  type ExecutionBook,
  type FillModelConfig,
} from './fills';

const model: FillModelConfig = {
  version: 'fill-v1',
  allowPartialFills: true,
  queueAheadRate: '0.25',
  marketImpactRate: '0',
  maxLevelParticipationRate: '1',
};

const book: ExecutionBook = {
  eventId: 'book-1',
  marketId: 'BINANCE:BTCUSDT',
  venueId: 'BINANCE',
  receivedAt: '2026-07-18T00:00:00.000Z',
  valid: true,
  bids: [{ price: '99', quantity: '2' }],
  asks: [{ price: '100', quantity: '1' }],
  availableUntil: '2026-07-18T00:00:02.000Z',
};

const request = {
  side: 'buy' as const,
  orderType: 'market' as const,
  quantity: '2',
  submittedAt: '2026-07-18T00:00:00.000Z',
  latencyMs: 100,
  cancelAfterMs: 1_000,
  feeRate: '0.001',
  slippageRate: '0',
};

describe('simulateFill', () => {
  it('models partial fills and exact fees from consumed depth', () => {
    const fill = simulateFill(request, book, model);
    expect(fill.status).toBe('partial');
    expect(fill.filledQuantity).toBe('1');
    expect(fill.quoteAmount).toBe('100');
    expect(fill.fee).toBe('0.1');
    expect(fill.evidence.bookEventId).toBe('book-1');
    expect(fill.modelVersion).toBe('fill-v1');
  });

  it('does not fill when liquidity disappeared before arrival', () => {
    const fill = simulateFill(
      { ...request, latencyMs: 3_000, cancelAfterMs: 4_000 },
      book,
      model,
    );
    expect(fill.status).toBe('unfilled');
    expect(fill.reason).toBe('liquidity_disappeared');
  });

  it('models cancellation before submission reaches the venue', () => {
    const fill = simulateFill(
      { ...request, latencyMs: 500, cancelAfterMs: 100 },
      book,
      model,
    );
    expect(fill.status).toBe('cancelled');
  });

  it('requires crossed depth for a limit order', () => {
    const fill = simulateFill(
      { ...request, orderType: 'limit', limitPrice: '99' },
      book,
      model,
    );
    expect(fill.status).toBe('unfilled');
    expect(fill.reason).toBe('limit_not_crossed');
  });

  it('can reject a partial fill in conservative models', () => {
    const fill = simulateFill(request, book, {
      ...model,
      allowPartialFills: false,
    });
    expect(fill.status).toBe('unfilled');
    expect(fill.reason).toBe('insufficient_depth');
  });
});

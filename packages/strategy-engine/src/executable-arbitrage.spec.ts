import Decimal from 'decimal.js';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  ExecutableArbitrageDetector,
  type ExecutableBookInput,
  type ExecutableDetectorConfig,
} from './executable-arbitrage';

const baseConfig: ExecutableDetectorConfig = {
  id: 'cross-venue-executable',
  version: '1.0.0',
  maximumBookAgeMs: 1_000,
  maximumCrossVenueSkewMs: 100,
  tradeSizes: ['1'],
  slippageBufferRate: '0',
  latencyBufferMs: 250,
  minimumNetProfitRate: '0',
  inventory: {},
};

const detector = (
  overrides: Partial<ExecutableDetectorConfig> = {},
): ExecutableArbitrageDetector =>
  new ExecutableArbitrageDetector({ ...baseConfig, ...overrides });

const evaluatedAt = new Date('2026-07-18T00:00:01Z');

const buyBook = (
  overrides: Partial<ExecutableBookInput> = {},
): ExecutableBookInput => ({
  eventId: 'buy-1',
  marketId: 'BINANCE:BTCUSDT',
  venueId: 'BINANCE',
  sequence: '1',
  receivedAt: new Date('2026-07-18T00:00:00.950Z'),
  valid: true,
  baseCurrency: 'BTC',
  quoteCurrency: 'USDT',
  bids: [{ price: '99', quantity: '10' }],
  asks: [{ price: '100', quantity: '10' }],
  takerFee: '0',
  priceIncrement: '0.01',
  quantityIncrement: '0.0001',
  ...overrides,
});

const sellBook = (
  overrides: Partial<ExecutableBookInput> = {},
): ExecutableBookInput => ({
  eventId: 'sell-1',
  marketId: 'KRAKEN:BTCUSD',
  venueId: 'KRAKEN',
  sequence: '1',
  receivedAt: new Date('2026-07-18T00:00:00.950Z'),
  valid: true,
  baseCurrency: 'BTC',
  quoteCurrency: 'USD',
  bids: [{ price: '110', quantity: '10' }],
  asks: [{ price: '111', quantity: '10' }],
  takerFee: '0',
  priceIncrement: '0.01',
  quantityIncrement: '0.0001',
  ...overrides,
});

describe('ExecutableArbitrageDetector construction', () => {
  it.each([
    { maximumBookAgeMs: 0 },
    { maximumBookAgeMs: Number.NaN },
    { maximumCrossVenueSkewMs: -1 },
    { latencyBufferMs: -1 },
  ])('rejects invalid timing thresholds %o', (overrides) => {
    expect(() => detector(overrides)).toThrow(RangeError);
  });

  it('rejects an empty trade-size list', () => {
    expect(() => detector({ tradeSizes: [] })).toThrow(RangeError);
  });

  it.each([['0'], ['-1'], ['abc']])(
    'rejects a non-positive or invalid trade size %s',
    (size) => {
      expect(() => detector({ tradeSizes: [size] })).toThrow();
    },
  );

  it('rejects a negative slippage buffer', () => {
    expect(() => detector({ slippageBufferRate: '-0.1' })).toThrow(RangeError);
  });
});

describe('ExecutableArbitrageDetector structural rejection', () => {
  it.each([
    ['invalid_book', { buy: { valid: false } }],
    ['missing_quote', { buy: { asks: [] } }],
    [
      'stale_book',
      { buy: { receivedAt: new Date('2026-07-17T23:59:59.500Z') } },
    ],
    [
      'cross_venue_skew',
      { sell: { receivedAt: new Date('2026-07-18T00:00:00.700Z') } },
    ],
  ] as const)('rejects with reason %s', (reason, overrides) => {
    const result = detector().evaluate(
      'BTC/USD',
      buyBook((overrides as { buy?: Partial<ExecutableBookInput> }).buy),
      sellBook((overrides as { sell?: Partial<ExecutableBookInput> }).sell),
      evaluatedAt,
    );
    expect(result.classification).toBe('rejected');
    expect(result.rejectionReason).toBe(reason);
    expect(result.sizeEvaluations).toHaveLength(0);
  });
});

describe('ExecutableArbitrageDetector classification', () => {
  it('classifies a profitable, unconstrained opportunity as executable', () => {
    const result = detector({ tradeSizes: ['1', '5'] }).evaluate(
      'BTC/USD',
      buyBook(),
      sellBook(),
      evaluatedAt,
    );
    expect(result.classification).toBe('executable');
    // buy 1 @ 100, sell 1 @ 110, no fees -> net 10; best size maximises net.
    expect(result.bestSize).toBe('5');
    expect(result.maxExecutableSize).toBe('5');
    expect(result.netProfit).toBe('50');
    expect(result.netProfitRate).toBe('0.1');
  });

  it('reports the exact profit breakdown with fees and slippage', () => {
    const result = detector({
      tradeSizes: ['2'],
      slippageBufferRate: '0.001',
    }).evaluate(
      'BTC/USD',
      buyBook({ takerFee: '0.001' }),
      sellBook({ takerFee: '0.002' }),
      evaluatedAt,
    );
    const evaluation = result.sizeEvaluations[0]!;
    // buy 2 @ 100 = 200, sell 2 @ 110 = 220.
    expect(evaluation.buyNotional).toBe('200');
    expect(evaluation.sellNotional).toBe('220');
    expect(evaluation.grossProfit).toBe('20');
    // fees: 200*0.001 + 220*0.002 = 0.2 + 0.44 = 0.64
    expect(evaluation.feeCost).toBe('0.64');
    // slippage: (200 + 220) * 0.001 = 0.42
    expect(evaluation.slippageCost).toBe('0.42');
    // net: 20 - 0.64 - 0.42 = 18.94
    expect(evaluation.netProfit).toBe('18.94');
    expect(result.classification).toBe('executable');
  });

  it('classifies fee-eroded edges as observed without claiming profit', () => {
    const result = detector({
      tradeSizes: ['1'],
      minimumNetProfitRate: '0.2',
    }).evaluate('BTC/USD', buyBook(), sellBook(), evaluatedAt);
    expect(result.classification).toBe('observed');
    expect(result.netProfit).toBeUndefined();
    expect(result.maxExecutableSize).toBeUndefined();
    expect(result.topOfBookSpread).toBe('0.1');
  });

  it('classifies a profitable but inventory-blocked size as missed', () => {
    const result = detector({
      tradeSizes: ['1'],
      inventory: { BINANCE: { USDT: '10' }, KRAKEN: { BTC: '10' } },
    }).evaluate('BTC/USD', buyBook(), sellBook(), evaluatedAt);
    expect(result.classification).toBe('missed');
    expect(result.blockReason).toBe('insufficient_inventory');
    expect(result.netProfit).toBeUndefined();
  });

  it('does not claim profit when a leg breaches minimum notional', () => {
    const result = detector({ tradeSizes: ['1'] }).evaluate(
      'BTC/USD',
      buyBook({ minimumNotional: '1000' }),
      sellBook(),
      evaluatedAt,
    );
    expect(result.classification).toBe('missed');
    expect(result.blockReason).toBe('below_min_notional');
  });

  it('rejects a size that exceeds available depth', () => {
    const result = detector({ tradeSizes: ['1000'] }).evaluate(
      'BTC/USD',
      buyBook(),
      sellBook(),
      evaluatedAt,
    );
    expect(result.classification).toBe('observed');
    expect(result.sizeEvaluations[0]!.depthSufficient).toBe(false);
    expect(result.sizeEvaluations[0]!.blockReasons).toContain(
      'insufficient_depth',
    );
  });

  it('computes a volume-weighted price across multiple levels', () => {
    const result = detector({ tradeSizes: ['3'] }).evaluate(
      'BTC/USD',
      buyBook({
        asks: [
          { price: '100', quantity: '1' },
          { price: '102', quantity: '2' },
        ],
      }),
      sellBook(),
      evaluatedAt,
    );
    const evaluation = result.sizeEvaluations[0]!;
    // (100*1 + 102*2) / 3 = 304 / 3, held at exact (80-digit) precision.
    expect(evaluation.buyNotional).toBe('304');
    expect(evaluation.vwapBuyPrice!.startsWith('101.3333333333')).toBe(true);
  });

  it('respects a satisfied inventory configuration', () => {
    const result = detector({
      tradeSizes: ['1'],
      inventory: { BINANCE: { USDT: '1000' }, KRAKEN: { BTC: '5' } },
    }).evaluate('BTC/USD', buyBook(), sellBook(), evaluatedAt);
    expect(result.classification).toBe('executable');
  });
});

describe('ExecutableArbitrageDetector properties', () => {
  const priceArb = fc.integer({ min: 1, max: 100_000 });
  const qtyArb = fc.integer({ min: 1, max: 1_000 });

  it('never labels executable when the sell price is at or below the buy price', () => {
    fc.assert(
      fc.property(priceArb, qtyArb, (ask, qty) => {
        const result = detector({ tradeSizes: ['1'] }).evaluate(
          'BTC/USD',
          buyBook({ asks: [{ price: String(ask), quantity: String(qty) }] }),
          sellBook({ bids: [{ price: String(ask), quantity: String(qty) }] }),
          evaluatedAt,
        );
        // equal prices, zero fees -> zero gross, not strictly profitable.
        expect(result.classification).not.toBe('executable');
      }),
    );
  });

  it('net profit equals gross minus fees minus slippage for every size', () => {
    fc.assert(
      fc.property(
        priceArb,
        priceArb,
        qtyArb,
        fc.constantFrom('0', '0.0005', '0.001'),
        (ask, bid, qty, slippage) => {
          const result = detector({
            tradeSizes: ['1'],
            slippageBufferRate: slippage,
          }).evaluate(
            'BTC/USD',
            buyBook({
              takerFee: '0.001',
              asks: [{ price: String(ask), quantity: String(qty) }],
            }),
            sellBook({
              takerFee: '0.001',
              bids: [{ price: String(bid), quantity: String(qty) }],
            }),
            evaluatedAt,
          );
          const evaluation = result.sizeEvaluations[0]!;
          if (!evaluation.depthSufficient) return;
          const gross = new Decimal(evaluation.grossProfit!);
          const fee = new Decimal(evaluation.feeCost!);
          const slip = new Decimal(evaluation.slippageCost!);
          const net = new Decimal(evaluation.netProfit!);
          expect(net.equals(gross.minus(fee).minus(slip))).toBe(true);
        },
      ),
    );
  });

  it('max executable size never exceeds the largest configured size', () => {
    fc.assert(
      fc.property(priceArb, priceArb, (ask, bid) => {
        const result = detector({ tradeSizes: ['1', '2', '3'] }).evaluate(
          'BTC/USD',
          buyBook({ asks: [{ price: String(ask), quantity: '100' }] }),
          sellBook({ bids: [{ price: String(bid), quantity: '100' }] }),
          evaluatedAt,
        );
        if (result.maxExecutableSize)
          expect(
            new Decimal(result.maxExecutableSize).lessThanOrEqualTo(3),
          ).toBe(true);
      }),
    );
  });
});

import type { OrderBook, OrderBookLevel } from '@quant-lab/market-data';

export type BookInvalidationReason =
  | 'checksum_mismatch'
  | 'crossed_book'
  | 'incomplete_book'
  | 'sequence_gap'
  | 'stale_book';

export interface BookInvalidation {
  reason: BookInvalidationReason;
  sequence?: string;
  details?: string;
}

export interface ExecutableLevel {
  price: string;
  quantity: string;
}

export interface ReconstructedBook {
  marketId: string;
  venueId: string;
  sequence: string;
  bids: readonly ExecutableLevel[];
  asks: readonly ExecutableLevel[];
  valid: boolean;
  invalidation?: BookInvalidation;
}

export interface BookEngineOptions {
  depth?: number;
  staleAfterMs?: number;
  verifyChecksum?: (book: ReconstructedBook, expected: string) => boolean;
  now?: () => number;
}

function decimalParts(value: string): [bigint, bigint] {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new TypeError(`invalid decimal: ${value}`);
  const fraction = match[3] ?? '';
  const sign = match[1] === '-' ? -1n : 1n;
  return [
    sign * BigInt(`${match[2]}${fraction}`),
    10n ** BigInt(fraction.length),
  ];
}

function compareDecimal(left: string, right: string): number {
  const [ln, ld] = decimalParts(left);
  const [rn, rd] = decimalParts(right);
  const difference = ln * rd - rn * ld;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function numericSequence(value: string): bigint | undefined {
  return /^\d+$/.test(value) ? BigInt(value) : undefined;
}

export class OrderBookEngine {
  readonly #bids = new Map<string, string>();
  readonly #asks = new Map<string, string>();
  readonly #depth: number;
  readonly #staleAfterMs: number;
  readonly #now: () => number;
  readonly #verifyChecksum?: BookEngineOptions['verifyChecksum'];
  #marketId?: string;
  #venueId?: string;
  #sequence?: string;
  #updatedAt?: number;
  #invalidation?: BookInvalidation;

  constructor(options: BookEngineOptions = {}) {
    this.#depth = Math.max(1, options.depth ?? 100);
    this.#staleAfterMs = Math.max(1, options.staleAfterMs ?? 5_000);
    this.#now = options.now ?? Date.now;
    this.#verifyChecksum = options.verifyChecksum;
  }

  apply(event: OrderBook): ReconstructedBook {
    if (event.kind === 'snapshot') {
      this.#bids.clear();
      this.#asks.clear();
      this.#marketId = event.marketId;
      this.#venueId = event.venueId;
      this.#invalidation = undefined;
    } else if (!this.#sequence) {
      return this.invalidate(
        'incomplete_book',
        event.sequence,
        'delta received before snapshot',
      );
    } else if (!this.isContinuous(event)) {
      return this.invalidate(
        'sequence_gap',
        event.sequence,
        `expected after ${this.#sequence}`,
      );
    }

    this.applyLevels(this.#bids, event.bids);
    this.applyLevels(this.#asks, event.asks);
    this.#sequence = event.sequence;
    this.#updatedAt = Number(event.time.receivedAt.epochMicroseconds / 1_000n);
    let book = this.view(false);
    if (book.bids.length === 0 || book.asks.length === 0)
      return this.invalidate('incomplete_book', event.sequence);
    if (compareDecimal(book.bids[0]!.price, book.asks[0]!.price) >= 0)
      return this.invalidate('crossed_book', event.sequence);
    if (
      event.checksum &&
      this.#verifyChecksum &&
      !this.#verifyChecksum(book, event.checksum)
    )
      return this.invalidate('checksum_mismatch', event.sequence);
    book = this.view(false);
    return book;
  }

  current(): ReconstructedBook {
    if (!this.#sequence) return this.view(false);
    if (
      this.#updatedAt !== undefined &&
      this.#now() - this.#updatedAt > this.#staleAfterMs
    )
      return this.invalidate('stale_book', this.#sequence);
    return this.view(false);
  }

  private isContinuous(event: OrderBook): boolean {
    if (event.previousSequence)
      return event.previousSequence === this.#sequence;
    const current = numericSequence(this.#sequence!);
    const next = numericSequence(event.sequence);
    return current === undefined || next === undefined || next === current + 1n;
  }

  private applyLevels(
    target: Map<string, string>,
    levels: readonly OrderBookLevel[],
  ): void {
    for (const level of levels) {
      const price = level.price.toString();
      const quantity = level.quantity.toString();
      if (quantity === '0') target.delete(price);
      else target.set(price, quantity);
    }
  }

  private invalidate(
    reason: BookInvalidationReason,
    sequence?: string,
    details?: string,
  ): ReconstructedBook {
    this.#invalidation = { reason, sequence, ...(details ? { details } : {}) };
    return this.view(false);
  }

  private view(checkStale: boolean): ReconstructedBook {
    if (checkStale) return this.current();
    const levels = (source: Map<string, string>, descending: boolean) =>
      [...source]
        .sort(([a], [b]) => compareDecimal(a, b) * (descending ? -1 : 1))
        .slice(0, this.#depth)
        .map(([price, quantity]) => ({ price, quantity }));
    return {
      marketId: this.#marketId ?? '',
      venueId: this.#venueId ?? '',
      sequence: this.#sequence ?? '',
      bids: levels(this.#bids, true),
      asks: levels(this.#asks, false),
      valid: this.#invalidation === undefined,
      ...(this.#invalidation ? { invalidation: this.#invalidation } : {}),
    };
  }
}

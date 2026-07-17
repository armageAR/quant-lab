import Decimal from 'decimal.js';

const DomainDecimal = Decimal.clone({
  precision: 80,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1_000_000,
  toExpPos: 1_000_000,
});

export type DecimalString = string;

export type RoundingMode = 'down' | 'half-even' | 'half-up' | 'up';

const ROUNDING_MODES: Record<RoundingMode, Decimal.Rounding> = {
  down: Decimal.ROUND_DOWN,
  'half-even': Decimal.ROUND_HALF_EVEN,
  'half-up': Decimal.ROUND_HALF_UP,
  up: Decimal.ROUND_UP,
};

function parseDecimal(value: DecimalString, field: string): Decimal {
  if (
    typeof value !== 'string' ||
    value.trim() !== value ||
    value.length === 0
  ) {
    throw new TypeError(
      `${field} must be a non-empty canonical decimal string`,
    );
  }

  const parsed = new DomainDecimal(value);
  if (!parsed.isFinite()) {
    throw new RangeError(`${field} must be finite`);
  }

  return parsed;
}

function canonical(value: Decimal): DecimalString {
  const fixed = value.toFixed();
  return fixed === '-0' ? '0' : fixed;
}

function requireContext(value: string, field: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._:-]{0,63}$/.test(normalized)) {
    throw new TypeError(`${field} is invalid`);
  }
  return normalized;
}

abstract class ExactDecimal {
  readonly #value: Decimal;

  protected constructor(value: DecimalString, field: string) {
    this.#value = parseDecimal(value, field);
  }

  protected decimal(): Decimal {
    return this.#value;
  }

  toString(): DecimalString {
    return canonical(this.#value);
  }

  protected numericEquals(other: ExactDecimal): boolean {
    return this.#value.equals(other.#value);
  }

  protected quantized(
    increment: DecimalString,
    mode: RoundingMode,
  ): DecimalString {
    const step = parseDecimal(increment, 'increment');
    if (!step.isPositive()) {
      throw new RangeError('increment must be positive');
    }
    return canonical(
      this.#value
        .dividedBy(step)
        .toDecimalPlaces(0, ROUNDING_MODES[mode])
        .times(step),
    );
  }
}

export class Price extends ExactDecimal {
  readonly marketId: string;

  private constructor(value: DecimalString, marketId: string) {
    super(value, 'price');
    if (!this.decimal().greaterThan(0))
      throw new RangeError('price must be positive');
    this.marketId = requireContext(marketId, 'marketId');
  }

  static from(value: DecimalString, marketId: string): Price {
    return new Price(value, marketId);
  }

  quantize(increment: DecimalString, mode: RoundingMode): Price {
    return Price.from(this.quantized(increment, mode), this.marketId);
  }

  equals(other: Price): boolean {
    return this.marketId === other.marketId && this.numericEquals(other);
  }

  toJSON(): { value: DecimalString; marketId: string } {
    return { value: this.toString(), marketId: this.marketId };
  }
}

export class Quantity extends ExactDecimal {
  readonly instrumentId: string;

  private constructor(value: DecimalString, instrumentId: string) {
    super(value, 'quantity');
    if (this.decimal().isNegative())
      throw new RangeError('quantity cannot be negative');
    this.instrumentId = requireContext(instrumentId, 'instrumentId');
  }

  static from(value: DecimalString, instrumentId: string): Quantity {
    return new Quantity(value, instrumentId);
  }

  quantize(increment: DecimalString, mode: RoundingMode): Quantity {
    return Quantity.from(this.quantized(increment, mode), this.instrumentId);
  }

  equals(other: Quantity): boolean {
    return (
      this.instrumentId === other.instrumentId && this.numericEquals(other)
    );
  }

  toJSON(): { value: DecimalString; instrumentId: string } {
    return { value: this.toString(), instrumentId: this.instrumentId };
  }
}

export class Money extends ExactDecimal {
  readonly currency: string;

  private constructor(value: DecimalString, currency: string) {
    super(value, 'money');
    this.currency = requireContext(currency, 'currency');
  }

  static from(value: DecimalString, currency: string): Money {
    return new Money(value, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new TypeError('cannot add money with different currencies');
    }
    return Money.from(
      this.decimal().plus(other.decimal()).toFixed(),
      this.currency,
    );
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new TypeError('cannot subtract money with different currencies');
    }
    return Money.from(
      this.decimal().minus(other.decimal()).toFixed(),
      this.currency,
    );
  }

  quantize(increment: DecimalString, mode: RoundingMode): Money {
    return Money.from(this.quantized(increment, mode), this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.numericEquals(other);
  }

  toJSON(): { value: DecimalString; currency: string } {
    return { value: this.toString(), currency: this.currency };
  }
}

export class FeeRate extends ExactDecimal {
  private constructor(value: DecimalString) {
    super(value, 'feeRate');
    if (this.decimal().lessThan('-1') || this.decimal().greaterThan('1')) {
      throw new RangeError('feeRate must be between -1 and 1');
    }
  }

  static from(value: DecimalString): FeeRate {
    return new FeeRate(value);
  }

  equals(other: FeeRate): boolean {
    return this.numericEquals(other);
  }

  toJSON(): { value: DecimalString } {
    return { value: this.toString() };
  }
}

export class Pnl extends ExactDecimal {
  readonly currency: string;

  private constructor(value: DecimalString, currency: string) {
    super(value, 'pnl');
    this.currency = requireContext(currency, 'currency');
  }

  static from(value: DecimalString, currency: string): Pnl {
    return new Pnl(value, currency);
  }

  equals(other: Pnl): boolean {
    return this.currency === other.currency && this.numericEquals(other);
  }

  toJSON(): { value: DecimalString; currency: string } {
    return { value: this.toString(), currency: this.currency };
  }
}

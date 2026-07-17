export type TimestampPrecision = 'millisecond' | 'microsecond';

export interface SerializedTimestamp {
  epochMicroseconds: string;
  iso8601: string;
  precision: TimestampPrecision;
  sourceValue?: string;
}

const MICROS_PER_MILLISECOND = 1_000n;

function parseInteger(value: string | bigint, field: string): bigint {
  if (typeof value === 'bigint') return value;
  if (!/^-?\d+$/.test(value))
    throw new TypeError(`${field} must be an integer string`);
  return BigInt(value);
}

export class SourceTimestamp {
  readonly epochMicroseconds: bigint;
  readonly precision: TimestampPrecision;
  readonly sourceValue?: string;

  private constructor(
    epochMicroseconds: bigint,
    precision: TimestampPrecision,
    sourceValue?: string,
  ) {
    this.epochMicroseconds = epochMicroseconds;
    this.precision = precision;
    this.sourceValue = sourceValue;
  }

  static fromEpochMilliseconds(
    value: string | bigint,
    sourceValue?: string,
  ): SourceTimestamp {
    return new SourceTimestamp(
      parseInteger(value, 'epochMilliseconds') * MICROS_PER_MILLISECOND,
      'millisecond',
      sourceValue,
    );
  }

  static fromEpochMicroseconds(
    value: string | bigint,
    sourceValue?: string,
  ): SourceTimestamp {
    return new SourceTimestamp(
      parseInteger(value, 'epochMicroseconds'),
      'microsecond',
      sourceValue,
    );
  }

  static fromSerialized(value: SerializedTimestamp): SourceTimestamp {
    if (
      value.precision !== 'millisecond' &&
      value.precision !== 'microsecond'
    ) {
      throw new TypeError('timestamp precision is invalid');
    }
    const timestamp = new SourceTimestamp(
      parseInteger(value.epochMicroseconds, 'epochMicroseconds'),
      value.precision,
      value.sourceValue,
    );
    if (
      value.precision === 'millisecond' &&
      timestamp.epochMicroseconds % MICROS_PER_MILLISECOND !== 0n
    ) {
      throw new RangeError(
        'millisecond timestamp contains fabricated microseconds',
      );
    }
    if (timestamp.toJSON().iso8601 !== value.iso8601) {
      throw new RangeError('serialized timestamp representations disagree');
    }
    return timestamp;
  }

  compare(other: SourceTimestamp): -1 | 0 | 1 {
    if (this.epochMicroseconds === other.epochMicroseconds) return 0;
    return this.epochMicroseconds < other.epochMicroseconds ? -1 : 1;
  }

  toJSON(): SerializedTimestamp {
    const milliseconds = this.epochMicroseconds / MICROS_PER_MILLISECOND;
    const microsecondRemainder = this.epochMicroseconds % 1_000_000n;
    const base = new Date(Number(milliseconds)).toISOString();
    const fraction = microsecondRemainder.toString().padStart(6, '0');

    return {
      epochMicroseconds: this.epochMicroseconds.toString(),
      iso8601: `${base.slice(0, 19)}.${fraction}Z`,
      precision: this.precision,
      ...(this.sourceValue === undefined
        ? {}
        : { sourceValue: this.sourceValue }),
    };
  }
}

export interface EventTimepoint {
  eventTime?: SourceTimestamp;
  receivedAt: SourceTimestamp;
  processedAt: SourceTimestamp;
  sequence?: string;
}

export function eventTimepoint(input: EventTimepoint): EventTimepoint {
  if (input.receivedAt.compare(input.processedAt) === 1) {
    throw new RangeError('receivedAt cannot be after processedAt');
  }
  if (input.sequence !== undefined && input.sequence.length === 0) {
    throw new TypeError('sequence cannot be empty');
  }
  return Object.freeze({ ...input });
}

export interface Clock {
  now(): SourceTimestamp;
  monotonicMilliseconds(): number;
}

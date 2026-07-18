import { createHash } from 'node:crypto';

import { SimulationClock } from './clock';

export interface ReplayEvent {
  ordinal: number;
  sourceId: string;
  eventType: string;
  marketId: string;
  venueId: string;
  canonicalSymbol?: string;
  eventTime?: string;
  receivedAt: string;
  payload: unknown;
}

export interface ReplayContext {
  clock: SimulationClock;
  seed: number;
  index: number;
}

export interface ReplaySummary<T> {
  eventCount: number;
  firstTime?: string;
  lastTime?: string;
  outputHash: string;
  outputs: readonly T[];
}

export type ReplayHandler<T> = (
  event: ReplayEvent,
  context: ReplayContext,
) => T | undefined | Promise<T | undefined>;

export interface ReplayOptions {
  checkpoint?: (processed: number, total: number) => void | Promise<void>;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function instant(event: ReplayEvent): Date {
  const value = new Date(event.receivedAt);
  if (Number.isNaN(value.getTime()))
    throw new RangeError(`event ${event.sourceId} has no usable timestamp`);
  return value;
}

export function validateReplayOrder(events: readonly ReplayEvent[]): void {
  let previousOrdinal = -1;
  let previousTime = -Infinity;
  const sourceIds = new Set<string>();
  for (const event of events) {
    const time = instant(event).getTime();
    if (event.ordinal <= previousOrdinal)
      throw new RangeError('dataset event ordering is ambiguous');
    if (time < previousTime)
      throw new RangeError('dataset received timestamps are not monotonic');
    if (sourceIds.has(event.sourceId))
      throw new RangeError(`duplicate dataset source: ${event.sourceId}`);
    previousOrdinal = event.ordinal;
    previousTime = time;
    sourceIds.add(event.sourceId);
  }
}

export async function replayDeterministically<T>(
  events: readonly ReplayEvent[],
  seed: number,
  handler: ReplayHandler<T>,
  options: ReplayOptions = {},
): Promise<ReplaySummary<T>> {
  if (!Number.isSafeInteger(seed))
    throw new RangeError('seed must be an integer');
  validateReplayOrder(events);
  const outputs: T[] = [];
  const first = events[0] ? instant(events[0]) : undefined;
  const clock = new SimulationClock(first ?? new Date(0));
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    clock.advanceTo(instant(event));
    const output = await handler(event, { clock, seed, index });
    if (output !== undefined) outputs.push(output);
    await options.checkpoint?.(index + 1, events.length);
  }
  const last = events.at(-1) ? instant(events.at(-1)!) : undefined;
  const identity = canonicalJson({ seed, events, outputs });
  return {
    eventCount: events.length,
    ...(first ? { firstTime: first.toISOString() } : {}),
    ...(last ? { lastTime: last.toISOString() } : {}),
    outputHash: createHash('sha256').update(identity).digest('hex'),
    outputs,
  };
}

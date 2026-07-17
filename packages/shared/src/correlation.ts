import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface CorrelationContext {
  correlationId: string;
  runId?: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();
const SAFE_CORRELATION_ID = /^[a-zA-Z0-9._:-]{1,128}$/;

export function normalizeCorrelationId(value: unknown): string {
  return typeof value === 'string' && SAFE_CORRELATION_ID.test(value)
    ? value
    : randomUUID();
}

export function runWithCorrelation<T>(
  context: CorrelationContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}

import {
  AuthenticationError,
  BadRequest,
  BadSymbol,
  ExchangeNotAvailable,
  NetworkError,
  PermissionDenied,
  RateLimitExceeded,
  RequestTimeout,
} from 'ccxt';

import { ProviderError, type ProviderErrorCode } from '@quant-lab/market-data';

export interface ResilienceOptions {
  venueId: string;
  attempts: number;
  timeoutMilliseconds: number;
  circuitFailures: number;
  circuitResetMilliseconds: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

export class ResilientExecutor {
  #failures = 0;
  #openedAt?: number;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #now: () => number;

  constructor(private readonly options: ResilienceOptions) {
    this.#sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.#now = options.now ?? Date.now;
  }

  async run<T>(operation: string, action: () => Promise<T>): Promise<T> {
    this.assertCircuit(operation);
    let lastError: ProviderError | undefined;

    for (let attempt = 1; attempt <= this.options.attempts; attempt += 1) {
      try {
        const result = await this.withTimeout(operation, action());
        this.#failures = 0;
        this.#openedAt = undefined;
        return result;
      } catch (error) {
        lastError = toProviderError(error, this.options.venueId, operation);
        if (!lastError.retryable || attempt === this.options.attempts) break;
        await this.#sleep(Math.min(250 * 2 ** (attempt - 1), 2_000));
      }
    }

    this.#failures += 1;
    if (this.#failures >= this.options.circuitFailures)
      this.#openedAt = this.#now();
    if (lastError === undefined)
      throw new Error('exchange operation failed without an error');
    throw lastError;
  }

  private assertCircuit(operation: string): void {
    if (this.#openedAt === undefined) return;
    if (this.#now() - this.#openedAt >= this.options.circuitResetMilliseconds) {
      this.#openedAt = undefined;
      this.#failures = 0;
      return;
    }
    throw new ProviderError('exchange circuit is open', {
      code: 'temporarily-unavailable',
      venueId: this.options.venueId,
      operation,
      retryable: true,
    });
  }

  private async withTimeout<T>(
    operation: string,
    action: Promise<T>,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const rejected = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new ProviderError('exchange operation timed out', {
              code: 'timeout',
              venueId: this.options.venueId,
              operation,
              retryable: true,
            }),
          ),
        this.options.timeoutMilliseconds,
      );
    });
    try {
      return await Promise.race([action, rejected]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

export function toProviderError(
  error: unknown,
  venueId: string,
  operation: string,
): ProviderError {
  if (error instanceof ProviderError) return error;
  let code: ProviderErrorCode = 'invalid-response';
  let retryable = false;
  if (error instanceof AuthenticationError) code = 'authentication';
  else if (error instanceof PermissionDenied) code = 'authorization';
  else if (error instanceof RateLimitExceeded) {
    code = 'rate-limited';
    retryable = true;
  } else if (error instanceof RequestTimeout) {
    code = 'timeout';
    retryable = true;
  } else if (
    error instanceof ExchangeNotAvailable ||
    error instanceof NetworkError
  ) {
    code = 'temporarily-unavailable';
    retryable = true;
  } else if (error instanceof BadSymbol) code = 'not-found';
  else if (error instanceof BadRequest) code = 'bad-request';
  return new ProviderError(`exchange operation failed (${code})`, {
    code,
    venueId,
    operation,
    retryable,
  });
}

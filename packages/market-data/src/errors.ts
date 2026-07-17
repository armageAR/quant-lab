export type ProviderErrorCode =
  | 'authentication'
  | 'authorization'
  | 'bad-request'
  | 'capability-unavailable'
  | 'invalid-response'
  | 'not-found'
  | 'rate-limited'
  | 'temporarily-unavailable'
  | 'timeout';

export interface ProviderErrorOptions {
  code: ProviderErrorCode;
  venueId: string;
  operation: string;
  retryable: boolean;
  retryAfterMilliseconds?: number;
  cause?: unknown;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly venueId: string;
  readonly operation: string;
  readonly retryable: boolean;
  readonly retryAfterMilliseconds?: number;

  constructor(message: string, options: ProviderErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ProviderError';
    this.code = options.code;
    this.venueId = options.venueId;
    this.operation = options.operation;
    this.retryable = options.retryable;
    this.retryAfterMilliseconds = options.retryAfterMilliseconds;
  }
}

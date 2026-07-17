import { parseConfig, z } from '@quant-lab/shared';

const booleanValue = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
const optionalCredential = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const exchangeCredentials = z
  .object({
    apiKey: optionalCredential,
    secret: optionalCredential,
  })
  .refine((value) => Boolean(value.apiKey) === Boolean(value.secret), {
    message: 'API key and secret must be configured together',
  });

export const connectivityConfigSchema = z.object({
  EXCHANGE_CONNECTIVITY_ENABLED: booleanValue.default(false),
  EXCHANGE_MARKETS: z
    .string()
    .default('BTC/USDT,BTC/USD')
    .transform((value) =>
      value
        .split(',')
        .map((market) => market.trim().toUpperCase())
        .filter(Boolean),
    ),
  EXCHANGE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(10_000),
  EXCHANGE_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  EXCHANGE_CIRCUIT_FAILURES: z.coerce.number().int().min(1).max(10).default(3),
  EXCHANGE_CIRCUIT_RESET_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(30_000),
  BINANCE_API_KEY: optionalCredential,
  BINANCE_API_SECRET: optionalCredential,
  BINANCE_SANDBOX: booleanValue.default(true),
  BINANCE_INTEGRATION_ENABLED: booleanValue.default(false),
  KRAKEN_API_KEY: optionalCredential,
  KRAKEN_API_SECRET: optionalCredential,
  KRAKEN_SANDBOX: booleanValue.default(false),
  KRAKEN_INTEGRATION_ENABLED: booleanValue.default(false),
});

export type ConnectivityConfig = z.infer<typeof connectivityConfigSchema>;

export interface VenueAdapterConfig {
  venue: 'binance' | 'kraken';
  apiKey: string;
  secret: string;
  sandbox: boolean;
  timeoutMilliseconds: number;
  retryAttempts: number;
  circuitFailures: number;
  circuitResetMilliseconds: number;
}

export function loadConnectivityConfig(
  source: NodeJS.ProcessEnv,
): ConnectivityConfig {
  const config = parseConfig(connectivityConfigSchema, source);
  exchangeCredentials.parse({
    apiKey: config.BINANCE_API_KEY,
    secret: config.BINANCE_API_SECRET,
  });
  exchangeCredentials.parse({
    apiKey: config.KRAKEN_API_KEY,
    secret: config.KRAKEN_API_SECRET,
  });
  return config;
}

export function venueConfig(
  config: ConnectivityConfig,
  venue: VenueAdapterConfig['venue'],
): VenueAdapterConfig {
  const prefix = venue === 'binance' ? 'BINANCE' : 'KRAKEN';
  const apiKey = config[`${prefix}_API_KEY`];
  const secret = config[`${prefix}_API_SECRET`];
  if (!apiKey || !secret)
    throw new Error(`${prefix} read-only credentials are not configured`);
  if (venue === 'kraken' && config.KRAKEN_SANDBOX) {
    throw new Error('Kraken Spot does not provide a CCXT sandbox endpoint');
  }
  return {
    venue,
    apiKey,
    secret,
    sandbox: config[`${prefix}_SANDBOX`],
    timeoutMilliseconds: config.EXCHANGE_TIMEOUT_MS,
    retryAttempts: config.EXCHANGE_RETRY_ATTEMPTS,
    circuitFailures: config.EXCHANGE_CIRCUIT_FAILURES,
    circuitResetMilliseconds: config.EXCHANGE_CIRCUIT_RESET_MS,
  };
}

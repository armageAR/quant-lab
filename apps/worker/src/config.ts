import { baseConfigSchema, parseConfig, z } from '@quant-lab/shared';
import type {
  ExecutableDetectorConfig,
  InventoryConfig,
} from '@quant-lab/strategy-engine';

const workerConfigSchema = baseConfigSchema.extend({
  APP_NAME: z.string().default('quant-lab-worker'),
  DATABASE_URL: z.string().url(),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
  OBSERVATION_LOOP_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(true),
  OBSERVATION_INTERVAL_MS: z.coerce.number().int().min(1_000).default(10_000),
  OBSERVATION_CATALOG_REFRESH_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(3_600_000),
  OBSERVATION_ORDER_BOOK_DEPTH: z.coerce
    .number()
    .int()
    .min(1)
    .max(1_000)
    .default(100),
  OBSERVATION_MAX_BACKOFF_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .default(60_000),
  OBSERVED_DETECTOR_VERSION: z.string().trim().min(1).default('1.0.0'),
  OBSERVED_MAX_BOOK_AGE_MS: z.coerce.number().int().min(1).default(5_000),
  OBSERVED_MAX_SKEW_MS: z.coerce.number().int().min(0).default(1_000),
  OBSERVED_MIN_SPREAD: z.string().trim().min(1).default('0'),
  EXECUTABLE_DETECTOR_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false),
  EXECUTABLE_DETECTOR_VERSION: z.string().trim().min(1).default('1.0.0'),
  EXECUTABLE_MAX_BOOK_AGE_MS: z.coerce.number().int().min(1).default(5_000),
  EXECUTABLE_MAX_SKEW_MS: z.coerce.number().int().min(0).default(1_000),
  EXECUTABLE_TRADE_SIZES: z.string().trim().min(1).default('0.01,0.1,1'),
  EXECUTABLE_SLIPPAGE_BUFFER: z.string().trim().min(1).default('0.0005'),
  EXECUTABLE_LATENCY_BUFFER_MS: z.coerce.number().int().min(0).default(250),
  EXECUTABLE_MIN_NET_PROFIT_RATE: z.string().trim().min(1).default('0'),
  EXECUTABLE_INVENTORY: z.string().trim().min(1).default('{}'),
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

export function loadWorkerConfig(
  source: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return parseConfig(workerConfigSchema, source);
}

function isDecimalString(value: string): boolean {
  return value.length > 0 && /^-?\d+(\.\d+)?$/.test(value);
}

function parseInventory(raw: string): InventoryConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('EXECUTABLE_INVENTORY must be valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('EXECUTABLE_INVENTORY must be a JSON object');
  const inventory: Record<string, Record<string, string>> = {};
  for (const [venue, balances] of Object.entries(parsed)) {
    if (typeof balances !== 'object' || balances === null)
      throw new Error('EXECUTABLE_INVENTORY balances must be objects');
    const venueBalances: Record<string, string> = {};
    for (const [currency, amount] of Object.entries(
      balances as Record<string, unknown>,
    )) {
      if (typeof amount !== 'string' || !isDecimalString(amount))
        throw new Error(
          `EXECUTABLE_INVENTORY.${venue}.${currency} must be a decimal string`,
        );
      venueBalances[currency] = amount;
    }
    inventory[venue] = venueBalances;
  }
  return inventory;
}

export function buildExecutableDetectorConfig(
  config: WorkerConfig,
): ExecutableDetectorConfig {
  const tradeSizes = config.EXECUTABLE_TRADE_SIZES.split(',')
    .map((size) => size.trim())
    .filter((size) => size.length > 0);
  if (tradeSizes.length === 0)
    throw new Error('EXECUTABLE_TRADE_SIZES must list at least one size');
  return {
    id: 'cross-venue-executable',
    version: config.EXECUTABLE_DETECTOR_VERSION,
    maximumBookAgeMs: config.EXECUTABLE_MAX_BOOK_AGE_MS,
    maximumCrossVenueSkewMs: config.EXECUTABLE_MAX_SKEW_MS,
    tradeSizes,
    slippageBufferRate: config.EXECUTABLE_SLIPPAGE_BUFFER,
    latencyBufferMs: config.EXECUTABLE_LATENCY_BUFFER_MS,
    minimumNetProfitRate: config.EXECUTABLE_MIN_NET_PROFIT_RATE,
    inventory: parseInventory(config.EXECUTABLE_INVENTORY),
  };
}

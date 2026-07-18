import { baseConfigSchema, parseConfig, z } from '@quant-lab/shared';

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
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

export function loadWorkerConfig(
  source: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return parseConfig(workerConfigSchema, source);
}

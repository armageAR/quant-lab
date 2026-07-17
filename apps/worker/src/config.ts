import { baseConfigSchema, parseConfig, z } from '@quant-lab/shared';

const workerConfigSchema = baseConfigSchema.extend({
  APP_NAME: z.string().default('quant-lab-worker'),
  DATABASE_URL: z.string().url(),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

export function loadWorkerConfig(
  source: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return parseConfig(workerConfigSchema, source);
}

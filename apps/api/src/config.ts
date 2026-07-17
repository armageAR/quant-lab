import { baseConfigSchema, parseConfig, z } from '@quant-lab/shared';

const apiConfigSchema = baseConfigSchema.extend({
  APP_NAME: z.string().default('quant-lab-api'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

export function loadApiConfig(
  source: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  return parseConfig(apiConfigSchema, source);
}

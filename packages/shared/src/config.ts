import { z } from 'zod';

const booleanFromEnvironment = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const runtimeEnvironmentSchema = z.enum([
  'development',
  'test',
  'production',
]);

export const baseConfigSchema = z.object({
  NODE_ENV: runtimeEnvironmentSchema.default('development'),
  APP_NAME: z.string().trim().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  LIVE_EXECUTION_ENABLED: booleanFromEnvironment.default(false),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;

export function parseConfig<T>(schema: z.ZodType<T>, source: unknown): T {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid application configuration: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export { z };

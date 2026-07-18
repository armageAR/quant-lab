import { parseConfig } from '@quant-lab/shared';
import { z } from 'zod';

const booleanValue = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const ibkrConfigSchema = z
  .object({
    IBKR_CONNECTIVITY_ENABLED: booleanValue.default(false),
    IBKR_PAPER_ENABLED: booleanValue.default(false),
    IBKR_PAPER_EXECUTION_ENABLED: booleanValue.default(false),
    IBKR_HOST: z.string().min(1).default('127.0.0.1'),
    IBKR_PORT: z.coerce.number().int().positive().optional(),
    IBKR_CLIENT_ID: z.coerce.number().int().min(0).optional(),
    IBKR_ACCOUNT_ID: z.string().min(1).optional(),
    IBKR_CONTRACT_IDS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((item) => Number.isSafeInteger(item) && item > 0),
      ),
    IBKR_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(10_000),
    IBKR_RECONNECT_MS: z.coerce
      .number()
      .int()
      .min(0)
      .max(300_000)
      .default(5_000),
    IBKR_MAX_REQUESTS_PER_SECOND: z.coerce
      .number()
      .int()
      .min(1)
      .max(40)
      .default(20),
    IBKR_REGULAR_TRADING_HOURS_ONLY: booleanValue.default(true),
  })
  .superRefine((config, context) => {
    if (
      config.IBKR_PAPER_EXECUTION_ENABLED &&
      !config.IBKR_CONNECTIVITY_ENABLED
    )
      context.addIssue({
        code: 'custom',
        message: 'paper execution requires connectivity',
      });
    if (!config.IBKR_CONNECTIVITY_ENABLED) return;
    if (!config.IBKR_PAPER_ENABLED)
      context.addIssue({
        code: 'custom',
        message: 'IBKR paper mode is required',
      });
    if (!config.IBKR_PORT || ![4002, 7497].includes(config.IBKR_PORT))
      context.addIssue({
        code: 'custom',
        message: 'IBKR_PORT must be a paper port (4002 or 7497)',
      });
    if (config.IBKR_CLIENT_ID === undefined)
      context.addIssue({
        code: 'custom',
        message: 'IBKR_CLIENT_ID is required',
      });
    if (!config.IBKR_ACCOUNT_ID)
      context.addIssue({
        code: 'custom',
        message: 'IBKR_ACCOUNT_ID is required',
      });
    if (config.IBKR_PAPER_EXECUTION_ENABLED && !config.IBKR_PAPER_ENABLED)
      context.addIssue({
        code: 'custom',
        message: 'paper execution requires paper mode',
      });
  });

export type IbkrConfig = z.infer<typeof ibkrConfigSchema>;

export function loadIbkrConfig(source: NodeJS.ProcessEnv): IbkrConfig {
  return parseConfig(ibkrConfigSchema, source);
}

import { runMain } from '@quant-lab/shared';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

import { IbkrReadOnlyAdapter } from './adapter';
import { TwsIbkrGatewayClient } from './client';
import { loadIbkrConfig } from './config';

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
  const config = loadIbkrConfig(process.env);
  const report = await new IbkrReadOnlyAdapter(
    config,
    new TwsIbkrGatewayClient(config),
  ).verify();
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

void runMain(main, {
  onFatal: (error) =>
    process.stderr.write(
      `${JSON.stringify({ status: 'error', message: error instanceof Error ? error.message : 'unknown' })}\n`,
    ),
});

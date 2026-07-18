import { DatabaseLifecycle } from '@quant-lab/database';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BacktestRunService,
  executeArbitrageBacktest,
  type JsonObject,
} from '../../src';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const database = new DatabaseLifecycle();
const datasetId = 'dataset_phase4_integration';
const checksum = `phase4-${randomUUID()}`;
const sourceId = randomUUID();

const configuration: JsonObject = {
  scenario: 'base',
  tradeSize: '0.01',
  orderType: 'market',
  submissionDelayMs: 100,
  cancelAfterMs: 1_000,
  feeRates: { BINANCE: '0.001' },
  slippageRate: '0',
  inventoryRebalanceRate: '0',
  fillModel: {
    version: 'fill-v1',
    allowPartialFills: true,
    queueAheadRate: '0',
    marketImpactRate: '0',
    maxLevelParticipationRate: '1',
  },
};

async function cleanup(): Promise<void> {
  await database.client.backtestRun.deleteMany({ where: { datasetId } });
  await database.client.backtestExperiment.deleteMany({
    where: { name: 'Phase 4 integration' },
  });
  await database.client.datasetEvent.deleteMany({
    where: { manifestId: datasetId },
  });
  await database.client.datasetManifest.deleteMany({
    where: { id: datasetId },
  });
  await database.client.rawMarketEnvelope.deleteMany({
    where: { id: sourceId },
  });
}

describe('persisted deterministic backtest queue', () => {
  beforeAll(async () => {
    await database.connect();
    await cleanup();
    await database.client.rawMarketEnvelope.create({
      data: {
        id: sourceId,
        idempotencyKey: `phase4-${sourceId}`,
        venueId: 'BINANCE',
        marketId: 'phase4-market',
        eventType: 'ticker',
        eventTime: new Date('2026-07-18T00:00:00Z'),
        receivedAt: new Date('2026-07-18T00:00:00Z'),
        processedAt: new Date('2026-07-18T00:00:00Z'),
        sourcePrecision: 'milliseconds',
        payload: { bid: '100' },
        checksum: 'phase4-source-checksum',
      },
    });
    await database.client.datasetManifest.create({
      data: {
        id: datasetId,
        checksum,
        schemaVersion: '1',
        from: new Date('2026-07-18T00:00:00Z'),
        to: new Date('2026-07-18T00:00:01Z'),
        eventCount: 1,
        sourceCoverage: { ticker: 1 },
        events: {
          create: {
            ordinal: 0,
            eventType: 'ticker',
            sourceId,
            occurredAt: new Date('2026-07-18T00:00:00Z'),
            checksum: 'phase4-source-checksum',
          },
        },
      },
    });
  });

  afterAll(async () => {
    await cleanup();
    await database.disconnect();
  });

  it('persists identical hashes for repeated identical runs', async () => {
    const service = new BacktestRunService(database.client);
    const experiment = await service.createExperiment(
      'Phase 4 integration',
      'identical inputs produce identical outputs',
    );
    const input = {
      experimentId: experiment.id,
      datasetId,
      seed: 42,
      codeCommit: 'integration-commit',
      configuration,
      modelVersions: {
        replay: '1.0.0',
        fill: 'fill-v1',
        fees: '1.0.0',
        slippage: '1.0.0',
        latency: '1.0.0',
        rebalancing: '1.0.0',
      },
    };
    const first = await service.queue(input);
    const second = await service.queue(input);
    await service.executeNext((run, events, control) =>
      executeArbitrageBacktest(run, events, {
        checkpoint: control.checkpoint,
      }),
    );
    await service.executeNext((run, events, control) =>
      executeArbitrageBacktest(run, events, {
        checkpoint: control.checkpoint,
      }),
    );
    const firstResult = await service.inspect(first.id);
    const secondResult = await service.inspect(second.id);
    expect(firstResult.status).toBe('completed');
    expect(secondResult.status).toBe('completed');
    expect(firstResult.outputHash).toBe(secondResult.outputHash);
    expect(firstResult.progress).toBe(100);
    expect(firstResult.codeCommit).toBe('integration-commit');
  });
});

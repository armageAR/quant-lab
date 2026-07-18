import { DatabaseLifecycle } from '@quant-lab/database';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { canonical, decimal, PaperTradingService } from '../../src';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const database = new DatabaseLifecycle();

describe('PaperTradingService integration', () => {
  async function cleanup() {
    const sessions = await database.client.paperSession.findMany({
      where: { name: 'integration paper' },
      select: { id: true },
    });
    const sessionIds = sessions.map((session) => session.id);
    const orders = await database.client.paperOrder.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);
    const fills = await database.client.paperFill.findMany({
      where: { orderId: { in: orderIds } },
      select: { id: true },
    });
    await database.client.paperLedgerEntry.deleteMany({
      where: { account: { sessionId: { in: sessionIds } } },
    });
    await database.client.paperFill.deleteMany({
      where: { id: { in: fills.map((fill) => fill.id) } },
    });
    await database.client.paperOrder.deleteMany({
      where: { id: { in: orderIds } },
    });
    await database.client.paperAlert.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await database.client.paperCampaign.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await database.client.paperAccount.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await database.client.paperSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
  }

  beforeAll(async () => {
    await database.connect();
    await cleanup();
  });
  afterAll(async () => {
    await cleanup();
    await database.disconnect();
  });

  it('recovers idempotently and reconciles every fill group', async () => {
    const service = new PaperTradingService(database.client);
    const created = (await service.createSession({
      name: 'integration paper',
      strategyVersion: 'test-v1',
      codeCommit: 'test-commit',
      configuration: {
        initialBalances: { BINANCE: { BTC: '1', USD: '1000' } },
        limits: {
          maximumOrderNotional: '100',
          maximumVenueExposure: '5000',
          maximumDailyLoss: '50',
          maximumFeedAgeMs: 5000,
          maximumInventoryImbalance: '1',
        },
      },
    })) as { id: string };
    await service.control(created.id, 'start');
    const intent = {
      idempotencyKey: 'paper-intent-1',
      correlationId: 'correlation-1',
      strategyVersion: 'test-v1',
      venueId: 'BINANCE',
      marketId: 'BINANCE:BTCUSD',
      side: 'buy' as const,
      baseAsset: 'BTC',
      quoteAsset: 'USD',
      quantity: '0.1',
      expectedPrice: '100',
    };
    const order = await service.submit(created.id, intent, {
      orderNotional: '10',
      venueExposure: '1001',
      dailyPnl: '0',
      feedAgeMs: 1,
      inventoryImbalance: '0',
    });
    const fill = {
      idempotencyKey: 'paper-fill-1',
      quantity: '0.1',
      price: '100',
      feeRate: '0.001',
      occurredAt: new Date(),
      evidence: { source: 'integration' },
    };
    const first = await service.fill(
      order.id,
      { base: 'BTC', quote: 'USD' },
      fill,
    );
    const repeated = await service.fill(
      order.id,
      { base: 'BTC', quote: 'USD' },
      fill,
    );
    expect(repeated.id).toBe(first.id);
    const groups = await database.client.paperLedgerEntry.groupBy({
      by: ['groupId'],
      where: { fillId: first.id },
      _sum: { amount: true },
    });
    expect(
      groups.every(
        (group) =>
          canonical(decimal(group._sum.amount?.toString() ?? '0')) === '0',
      ),
    ).toBe(true);
    await expect(
      service.fill(
        order.id,
        { base: 'BTC', quote: 'USD' },
        { ...fill, idempotencyKey: 'too-much', quantity: '0.01' },
      ),
    ).rejects.toThrow();
    await service.control(created.id, 'emergency-stop');
    await expect(
      database.client.paperSession.findUniqueOrThrow({
        where: { id: created.id },
      }),
    ).resolves.toMatchObject({
      status: 'emergency_stopped',
      emergencyAt: expect.any(Date),
    });
  });
});

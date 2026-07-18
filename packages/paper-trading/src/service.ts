import type { DatabaseClient } from '@quant-lab/database';
import type { Prisma } from '@prisma/client';

import {
  canonical,
  decimal,
  nextOrderStatus,
  type ExecutionIntent,
  type PaperRiskLimits,
  type SimulatedFill,
} from './model';
import { evaluateRisk } from './risk';

interface SessionConfiguration {
  limits: PaperRiskLimits;
  initialBalances: Record<string, Record<string, string>>;
  campaign?: { minimumDurationHours: number; minimumSampleCount: number };
}
interface PaperOrderRecord {
  id: string;
  sessionId: string;
  status: string;
}

export class PaperTradingService {
  constructor(private readonly database: DatabaseClient) {}

  async createSession(input: {
    name: string;
    strategyVersion: string;
    codeCommit: string;
    configuration: SessionConfiguration;
  }): Promise<unknown> {
    if (
      !input.name.trim() ||
      !input.strategyVersion.trim() ||
      !input.codeCommit.trim()
    )
      throw new TypeError('name, strategyVersion and codeCommit are required');
    for (const [venue, balances] of Object.entries(
      input.configuration.initialBalances,
    ))
      for (const [asset, value] of Object.entries(balances))
        if (decimal(value).isNegative())
          throw new RangeError(`${venue}.${asset} balance cannot be negative`);
    for (const [field, value] of Object.entries({
      maximumOrderNotional: input.configuration.limits.maximumOrderNotional,
      maximumVenueExposure: input.configuration.limits.maximumVenueExposure,
      maximumDailyLoss: input.configuration.limits.maximumDailyLoss,
      maximumInventoryImbalance:
        input.configuration.limits.maximumInventoryImbalance,
    }))
      if (decimal(value).isNegative())
        throw new RangeError(`${field} cannot be negative`);
    if (input.configuration.limits.maximumFeedAgeMs < 0)
      throw new RangeError('maximumFeedAgeMs cannot be negative');
    const accounts = Object.entries(
      input.configuration.initialBalances,
    ).flatMap(([venueId, balances]) =>
      Object.entries(balances).flatMap(([asset, available]) => [
        { venueId, asset, available, reserved: '0' },
        {
          venueId: `SYSTEM:${venueId}`,
          asset,
          available: canonical(decimal(available).negated()),
          reserved: '0',
        },
      ]),
    );
    return this.database.paperSession.create({
      data: {
        name: input.name.trim(),
        status: 'draft',
        strategyVersion: input.strategyVersion.trim(),
        codeCommit: input.codeCommit.trim(),
        configuration: input.configuration as never,
        accounts: { create: accounts },
      },
      include: { accounts: true },
    });
  }

  async listSessions(): Promise<unknown> {
    return this.database.paperSession.findMany({
      include: {
        accounts: true,
        alerts: { orderBy: { createdAt: 'desc' }, take: 20 },
        campaigns: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async inspect(id: string): Promise<unknown> {
    return this.database.paperSession.findUniqueOrThrow({
      where: { id },
      include: {
        accounts: true,
        orders: {
          include: { fills: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        },
        alerts: { orderBy: { createdAt: 'desc' } },
        campaigns: true,
      },
    });
  }

  async control(
    id: string,
    action: 'start' | 'pause' | 'stop' | 'emergency-stop',
  ): Promise<unknown> {
    const session = await this.database.paperSession.findUniqueOrThrow({
      where: { id },
    });
    const allowed: Record<string, string[]> = {
      start: ['draft', 'paused'],
      pause: ['running'],
      stop: ['running', 'paused'],
      'emergency-stop': ['draft', 'running', 'paused'],
    };
    if (!allowed[action]?.includes(session.status))
      throw new RangeError(`cannot ${action} a ${session.status} session`);
    const status =
      action === 'start'
        ? 'running'
        : action === 'pause'
          ? 'paused'
          : action === 'stop'
            ? 'stopped'
            : 'emergency_stopped';
    return this.database.paperSession.update({
      where: { id },
      data: {
        status,
        ...(action === 'start'
          ? { startedAt: session.startedAt ?? new Date() }
          : {}),
        ...(action === 'stop' ? { stoppedAt: new Date() } : {}),
        ...(action === 'emergency-stop'
          ? { emergencyAt: new Date(), stoppedAt: new Date() }
          : {}),
      },
    });
  }

  async submit(
    sessionId: string,
    intent: ExecutionIntent,
    risk: Parameters<typeof evaluateRisk>[1],
  ): Promise<PaperOrderRecord> {
    const session = await this.database.paperSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (session.status !== 'running')
      throw new RangeError('paper session is not running');
    const existing = await this.database.paperOrder.findUnique({
      where: { idempotencyKey: intent.idempotencyKey },
    });
    if (existing) return existing;
    const configuration =
      session.configuration as unknown as SessionConfiguration;
    const reasons = evaluateRisk(configuration.limits, risk);
    if (reasons.length) {
      const order = await this.database.paperOrder.upsert({
        where: { idempotencyKey: intent.idempotencyKey },
        update: {},
        create: {
          sessionId,
          idempotencyKey: intent.idempotencyKey,
          correlationId: intent.correlationId,
          opportunityId: intent.opportunityId,
          strategyVersion: intent.strategyVersion,
          venueId: intent.venueId,
          marketId: intent.marketId,
          side: intent.side,
          status: 'rejected',
          requestedQuantity: intent.quantity,
          rejectionReason: reasons.join(','),
        },
      });
      await this.database.paperAlert.create({
        data: {
          sessionId,
          severity: 'warning',
          code: 'risk_block',
          message: reasons.join(', '),
          details: { orderId: order.id },
        },
      });
      return order;
    }
    const reservationAsset =
      intent.side === 'buy' ? intent.quoteAsset : intent.baseAsset;
    const reservationAmount =
      intent.side === 'buy'
        ? canonical(decimal(intent.quantity).times(intent.expectedPrice))
        : intent.quantity;
    return this.database.$transaction(async (tx) => {
      const account = await tx.paperAccount.findUniqueOrThrow({
        where: {
          sessionId_venueId_asset: {
            sessionId,
            venueId: intent.venueId,
            asset: reservationAsset,
          },
        },
      });
      const sufficient = !decimal(account.available.toString()).lessThan(
        decimal(account.reserved.toString()).plus(reservationAmount),
      );
      const order = await tx.paperOrder.create({
        data: {
          sessionId,
          idempotencyKey: intent.idempotencyKey,
          correlationId: intent.correlationId,
          opportunityId: intent.opportunityId,
          strategyVersion: intent.strategyVersion,
          venueId: intent.venueId,
          marketId: intent.marketId,
          side: intent.side,
          status: sufficient ? 'reserved' : 'rejected',
          requestedQuantity: intent.quantity,
          expectedProfit: intent.expectedProfit,
          ...(!sufficient ? { rejectionReason: 'insufficient_balance' } : {}),
        },
      });
      if (sufficient)
        await tx.paperAccount.update({
          where: { id: account.id },
          data: { reserved: { increment: reservationAmount } },
        });
      return order;
    });
  }

  async fill(
    orderId: string,
    assets: { base: string; quote: string },
    fill: SimulatedFill,
  ): Promise<{ id: string }> {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.paperFill.findUnique({
        where: { idempotencyKey: fill.idempotencyKey },
      });
      if (existing) return existing;
      const order = await tx.paperOrder.findUniqueOrThrow({
        where: { id: orderId },
      });
      if (!['reserved', 'partially_filled'].includes(order.status))
        throw new RangeError(`cannot fill a ${order.status} order`);
      const total = decimal(order.filledQuantity.toString()).plus(
        fill.quantity,
      );
      if (total.greaterThan(order.requestedQuantity.toString()))
        throw new RangeError('filled quantity exceeds requested quantity');
      const notional = decimal(fill.quantity).times(fill.price);
      const fee = notional.times(fill.feeRate);
      const complete = total.equals(order.requestedQuantity.toString());
      const row = await tx.paperFill.create({
        data: {
          orderId,
          idempotencyKey: fill.idempotencyKey,
          quantity: fill.quantity,
          price: fill.price,
          fee: canonical(fee),
          feeAsset: assets.quote,
          occurredAt: fill.occurredAt,
          evidence: fill.evidence as never,
        },
      });
      const movements =
        order.side === 'buy'
          ? [
              {
                asset: assets.base,
                amount: fill.quantity,
                reason: 'base_fill',
              },
              {
                asset: assets.quote,
                amount: canonical(notional.plus(fee).negated()),
                reason: 'quote_and_fee',
              },
            ]
          : [
              {
                asset: assets.base,
                amount: canonical(decimal(fill.quantity).negated()),
                reason: 'base_fill',
              },
              {
                asset: assets.quote,
                amount: canonical(notional.minus(fee)),
                reason: 'quote_after_fee',
              },
            ];
      const reservedAsset = order.side === 'buy' ? assets.quote : assets.base;
      const reservedAmount =
        order.side === 'buy' ? canonical(notional) : fill.quantity;
      await tx.paperAccount.update({
        where: {
          sessionId_venueId_asset: {
            sessionId: order.sessionId,
            venueId: order.venueId,
            asset: reservedAsset,
          },
        },
        data: { reserved: { decrement: reservedAmount } },
      });
      for (const movement of movements)
        await this.transfer(
          tx,
          order.sessionId,
          order.venueId,
          movement.asset,
          movement.amount,
          row.id,
          `${row.id}:${movement.asset}`,
          movement.reason,
        );
      const weighted = decimal(order.averagePrice?.toString() ?? '0')
        .times(order.filledQuantity.toString())
        .plus(notional)
        .dividedBy(total);
      await tx.paperOrder.update({
        where: { id: orderId },
        data: {
          status: nextOrderStatus(
            order.status as never,
            complete ? 'fill' : 'partial_fill',
          ),
          filledQuantity: canonical(total),
          averagePrice: canonical(weighted),
        },
      });
      return row;
    });
  }

  async executeOpportunity(
    sessionId: string,
    opportunityId: string,
  ): Promise<unknown> {
    const opportunity =
      await this.database.executableOpportunity.findUniqueOrThrow({
        where: { id: opportunityId },
        include: { buyBook: true, sellBook: true },
      });
    if (opportunity.classification !== 'executable' || !opportunity.bestSize)
      throw new RangeError('opportunity is not executable');
    const market = await this.database.market.findUniqueOrThrow({
      where: { id: opportunity.buyMarketId },
      include: { instrument: true },
    });
    const buyPrice = this.topPrice(opportunity.buyBook.asks);
    const sellPrice = this.topPrice(opportunity.sellBook.bids);
    const quantity = opportunity.bestSize.toString();
    const now = new Date();
    const session = await this.database.paperSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { accounts: true },
    });
    const config = session.configuration as unknown as SessionConfiguration;
    const risk = async (venueId: string, price: string) => ({
      orderNotional: canonical(decimal(quantity).times(price)),
      venueExposure: await this.venueExposure(
        sessionId,
        venueId,
        canonical(decimal(quantity).times(price)),
      ),
      dailyPnl: await this.dailyPnl(sessionId),
      feedAgeMs: Math.max(
        opportunity.buyFreshnessMs,
        opportunity.sellFreshnessMs,
      ),
      inventoryImbalance: this.inventoryImbalance(
        session.accounts,
        market.instrument.baseCurrency,
      ),
    });
    const common = {
      opportunityId,
      strategyVersion: session.strategyVersion,
      marketId: opportunity.buyMarketId,
      baseAsset: market.instrument.baseCurrency,
      quoteAsset: market.instrument.quoteCurrency,
      quantity,
      expectedProfit: opportunity.netProfit?.toString(),
    };
    const buy = await this.submit(
      sessionId,
      {
        ...common,
        idempotencyKey: `${sessionId}:${opportunityId}:buy`,
        correlationId: opportunityId,
        venueId: opportunity.buyVenueId,
        side: 'buy',
        expectedPrice: buyPrice,
        expectedProfit: undefined,
      },
      await risk(opportunity.buyVenueId, buyPrice),
    );
    const sell = await this.submit(
      sessionId,
      {
        ...common,
        marketId: opportunity.sellMarketId,
        idempotencyKey: `${sessionId}:${opportunityId}:sell`,
        correlationId: opportunityId,
        venueId: opportunity.sellVenueId,
        side: 'sell',
        expectedPrice: sellPrice,
      },
      await risk(opportunity.sellVenueId, sellPrice),
    );
    if (buy.status === 'reserved')
      await this.fill(
        buy.id,
        {
          base: market.instrument.baseCurrency,
          quote: market.instrument.quoteCurrency,
        },
        {
          idempotencyKey: `${buy.id}:fill`,
          quantity,
          price: buyPrice,
          feeRate: opportunity.buyTakerFee.toString(),
          occurredAt: now,
          evidence: {
            bookEventId: opportunity.buyBookEventId,
            simulated: true,
          },
        },
      );
    if (sell.status === 'reserved')
      await this.fill(
        sell.id,
        {
          base: market.instrument.baseCurrency,
          quote: market.instrument.quoteCurrency,
        },
        {
          idempotencyKey: `${sell.id}:fill`,
          quantity,
          price: sellPrice,
          feeRate: opportunity.sellTakerFee.toString(),
          occurredAt: now,
          evidence: {
            bookEventId: opportunity.sellBookEventId,
            simulated: true,
          },
        },
      );
    if (buy.status === 'reserved' && sell.status === 'reserved') {
      const simulatedProfit = canonical(
        decimal(sellPrice)
          .minus(buyPrice)
          .times(quantity)
          .minus(
            decimal(buyPrice)
              .times(quantity)
              .times(opportunity.buyTakerFee.toString()),
          )
          .minus(
            decimal(sellPrice)
              .times(quantity)
              .times(opportunity.sellTakerFee.toString()),
          ),
      );
      await this.database.paperOrder.updateMany({
        where: { id: sell.id, status: 'filled' },
        data: { simulatedProfit },
      });
    }
    return {
      buy: await this.database.paperOrder.findUniqueOrThrow({
        where: { id: buy.id },
      }),
      sell: await this.database.paperOrder.findUniqueOrThrow({
        where: { id: sell.id },
      }),
      limits: config.limits,
    };
  }

  async startCampaign(
    sessionId: string,
    input: {
      name: string;
      minimumDurationHours: number;
      minimumSampleCount: number;
    },
  ): Promise<unknown> {
    if (input.minimumDurationHours < 1 || input.minimumSampleCount < 1)
      throw new RangeError('campaign minimums must be positive');
    return this.database.paperCampaign.create({
      data: {
        sessionId,
        name: input.name,
        status: 'running',
        minimumDurationHours: input.minimumDurationHours,
        minimumSampleCount: input.minimumSampleCount,
        startedAt: new Date(),
      },
    });
  }
  async campaignReport(id: string, finalize = false): Promise<unknown> {
    const campaign = await this.database.paperCampaign.findUniqueOrThrow({
      where: { id },
      include: { session: { include: { orders: true, alerts: true } } },
    });
    const completed = campaign.session.orders.filter(
      (order) => order.status === 'filled',
    );
    const rejected = campaign.session.orders.filter(
      (order) => order.status === 'rejected',
    );
    const durationHours = campaign.startedAt
      ? (Date.now() - campaign.startedAt.getTime()) / 3_600_000
      : 0;
    const eligible =
      durationHours >= campaign.minimumDurationHours &&
      completed.length >= campaign.minimumSampleCount;
    const expectedProfit = completed.reduce(
      (sum, order) => sum.plus(order.expectedProfit?.toString() ?? '0'),
      decimal('0'),
    );
    const simulatedProfit = completed.reduce(
      (sum, order) => sum.plus(order.simulatedProfit?.toString() ?? '0'),
      decimal('0'),
    );
    const correlations = new Map<string, string[]>();
    for (const order of campaign.session.orders)
      correlations.set(order.correlationId, [
        ...(correlations.get(order.correlationId) ?? []),
        order.status,
      ]);
    const report = {
      durationHours,
      uptimeHours: durationHours,
      sampleCount: completed.length,
      rejectedCount: rejected.length,
      expectedProfit: canonical(expectedProfit),
      simulatedProfit: canonical(simulatedProfit),
      expectedVersusSimulated: canonical(simulatedProfit.minus(expectedProfit)),
      missedLegs: [...correlations.values()].filter(
        (statuses) =>
          statuses.filter((status) => status === 'filled').length === 1,
      ).length,
      feedGaps: campaign.session.alerts.filter((alert) =>
        alert.message.includes('stale_feed'),
      ).length,
      riskBlocks: campaign.session.alerts.filter(
        (alert) => alert.code === 'risk_block',
      ).length,
      unresolvedRisks: campaign.session.alerts
        .filter((alert) => !alert.resolvedAt)
        .map((alert) => alert.message),
      decision: eligible ? 'go_to_review' : 'no_go_insufficient_evidence',
      automaticPromotion: false,
    };
    if (finalize)
      await this.database.paperCampaign.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          decision: report.decision,
          report,
        },
      });
    return report;
  }

  private topPrice(levels: unknown): string {
    const level = Array.isArray(levels) ? (levels as unknown[])[0] : undefined;
    if (!level || typeof level !== 'object')
      throw new Error('order book has no usable top level');
    const price = (level as { price?: unknown }).price;
    if (typeof price !== 'string')
      throw new Error('order book price is invalid');
    return price;
  }
  private async venueExposure(
    sessionId: string,
    venueId: string,
    pendingNotional: string,
  ): Promise<string> {
    const orders = await this.database.paperOrder.findMany({
      where: {
        sessionId,
        venueId,
        status: { in: ['reserved', 'partially_filled', 'filled'] },
      },
      select: { filledQuantity: true, averagePrice: true },
    });
    return canonical(
      orders.reduce(
        (sum, order) =>
          sum.plus(
            decimal(order.filledQuantity.toString()).times(
              order.averagePrice?.toString() ?? '0',
            ),
          ),
        decimal(pendingNotional),
      ),
    );
  }

  private async dailyPnl(sessionId: string): Promise<string> {
    const orders = await this.database.paperOrder.findMany({
      where: {
        sessionId,
        updatedAt: { gte: new Date(Date.now() - 86_400_000) },
        simulatedProfit: { not: null },
      },
      select: { simulatedProfit: true },
    });
    return canonical(
      orders.reduce(
        (sum, order) => sum.plus(order.simulatedProfit?.toString() ?? '0'),
        decimal('0'),
      ),
    );
  }

  private inventoryImbalance(
    accounts: Array<{
      venueId: string;
      asset: string;
      available: { toString(): string };
    }>,
    asset: string,
  ): string {
    const balances = accounts
      .filter(
        (account) =>
          account.asset === asset && !account.venueId.startsWith('SYSTEM:'),
      )
      .map((account) => decimal(account.available.toString()));
    if (balances.length < 2) return '0';
    const maximum = balances.reduce((left, right) =>
      left.greaterThan(right) ? left : right,
    );
    const minimum = balances.reduce((left, right) =>
      left.lessThan(right) ? left : right,
    );
    return canonical(maximum.minus(minimum));
  }
  private async transfer(
    tx: Prisma.TransactionClient,
    sessionId: string,
    venueId: string,
    asset: string,
    amount: string,
    fillId: string,
    groupId: string,
    reason: string,
  ) {
    const user = await tx.paperAccount.findUniqueOrThrow({
      where: { sessionId_venueId_asset: { sessionId, venueId, asset } },
    });
    const system = await tx.paperAccount.findUniqueOrThrow({
      where: {
        sessionId_venueId_asset: {
          sessionId,
          venueId: `SYSTEM:${venueId}`,
          asset,
        },
      },
    });
    if (decimal(user.available.toString()).plus(amount).isNegative())
      throw new RangeError(`insufficient ${asset} balance on ${venueId}`);
    await tx.paperAccount.update({
      where: { id: user.id },
      data: { available: { increment: amount } },
    });
    await tx.paperAccount.update({
      where: { id: system.id },
      data: { available: { decrement: amount } },
    });
    await tx.paperLedgerEntry.createMany({
      data: [
        { accountId: user.id, fillId, groupId, amount, reason },
        {
          accountId: system.id,
          fillId,
          groupId,
          amount: canonical(decimal(amount).negated()),
          reason: `${reason}_counterparty`,
        },
      ],
    });
  }
}

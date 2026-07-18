import type { DatabaseClient } from '@quant-lab/database';
import { createHash } from 'node:crypto';

const transitions: Record<string, readonly string[]> = {
  scheduled: ['running', 'cancelled'],
  running: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'cancelled'],
  failed: ['scheduled'],
};

export class StrategyRunsService {
  constructor(private readonly database: DatabaseClient) {}

  list(): Promise<unknown[]> {
    return this.database.strategyRun.findMany({
      include: {
        strategyVersion: { include: { strategy: true } },
        parameterSet: true,
        auditEvents: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }

  async publish(input: {
    id: string;
    name: string;
    description: string;
    version: string;
    commitSha: string;
    configurationSchema: unknown;
    requirements: unknown;
  }): Promise<unknown> {
    if (!input.id || !input.name || !input.version || !input.commitSha)
      throw new TypeError('strategy identity and commit are required');
    const strategy = await this.database.strategyDefinition.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        name: input.name,
        description: input.description,
      },
      update: {},
    });
    const existing = await this.database.strategyVersion.findUnique({
      where: {
        strategyId_version: { strategyId: strategy.id, version: input.version },
      },
    });
    if (existing) {
      if (existing.commitSha !== input.commitSha)
        throw new Error('published strategy versions are immutable');
      return existing;
    }
    return this.database.strategyVersion.create({
      data: {
        strategyId: strategy.id,
        version: input.version,
        commitSha: input.commitSha,
        configurationSchema: input.configurationSchema as never,
        requirements: input.requirements as never,
      },
    });
  }

  async createParameterSet(input: {
    strategyVersionId: string;
    name: string;
    parameters: unknown;
  }): Promise<unknown> {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input.parameters))
      .digest('hex');
    return this.database.strategyParameterSet.upsert({
      where: { fingerprint },
      create: { ...input, parameters: input.parameters as never, fingerprint },
      update: {},
    });
  }

  async schedule(input: {
    strategyVersionId: string;
    parameterSetId: string;
    inputKind: 'dataset' | 'feed';
    inputReference: string;
    sourceCommit: string;
  }): Promise<unknown> {
    if (!input.inputReference || !input.sourceCommit)
      throw new TypeError('input reference and source commit are required');
    return this.database.strategyRun.create({
      data: {
        ...input,
        status: 'scheduled',
        auditEvents: {
          create: {
            toStatus: 'scheduled',
            reason: 'operator_schedule',
            details: {},
          },
        },
      },
      include: { auditEvents: true },
    });
  }

  async transition(
    id: string,
    toStatus: string,
    reason: string,
  ): Promise<unknown> {
    return this.database.$transaction(async (tx) => {
      const run = await tx.strategyRun.findUniqueOrThrow({ where: { id } });
      if (!transitions[run.status]?.includes(toStatus))
        throw new Error(
          `invalid strategy run transition ${run.status} -> ${toStatus}`,
        );
      const now = new Date();
      return tx.strategyRun.update({
        where: { id },
        data: {
          status: toStatus,
          ...(toStatus === 'running' && !run.startedAt
            ? { startedAt: now }
            : {}),
          ...(['completed', 'failed', 'cancelled'].includes(toStatus)
            ? { completedAt: now }
            : {}),
          ...(run.status === 'failed' && toStatus === 'scheduled'
            ? { attempt: { increment: 1 }, error: null, completedAt: null }
            : {}),
          auditEvents: {
            create: { fromStatus: run.status, toStatus, reason, details: {} },
          },
        },
        include: { auditEvents: { orderBy: { createdAt: 'asc' } } },
      });
    });
  }
}

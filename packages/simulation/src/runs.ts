import type { DatabaseClient } from '@quant-lab/database';

import type { ReplayEvent } from './replay';

export type BacktestRunStatus =
  'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type JsonValue =
  string | number | boolean | null | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface QueueBacktestRun {
  experimentId: string;
  datasetId: string;
  seed: number;
  codeCommit: string;
  configuration: JsonObject;
  modelVersions: Record<string, string>;
}

export interface BacktestExperimentView {
  id: string;
  name: string;
  hypothesis: string;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BacktestExecutionResult {
  outputHash: string;
  metrics: JsonObject;
  results: JsonObject;
}

export interface BacktestRunView {
  id: string;
  experimentId: string;
  datasetId: string;
  status: BacktestRunStatus;
  seed: number;
  codeCommit: string;
  configuration: JsonObject;
  modelVersions: Record<string, string>;
  progress: number;
  totalEvents: number;
  outputHash?: string;
  metrics?: JsonObject;
  results?: JsonObject;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RunControl {
  checkpoint(processed: number, total: number): Promise<void>;
}

export type BacktestExecutor = (
  run: BacktestRunView,
  events: readonly ReplayEvent[],
  control: RunControl,
) => Promise<BacktestExecutionResult>;

class RunInterrupted extends Error {
  constructor(readonly status: 'paused' | 'cancelled') {
    super(`backtest run ${status}`);
  }
}

function jsonObject(value: unknown): JsonObject {
  return (value ?? {}) as JsonObject;
}

function view(row: {
  id: string;
  experimentId: string;
  datasetId: string;
  status: string;
  seed: number;
  codeCommit: string;
  configuration: unknown;
  modelVersions: unknown;
  progress: number;
  totalEvents: number;
  outputHash: string | null;
  metrics: unknown;
  results: unknown;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): BacktestRunView {
  return {
    id: row.id,
    experimentId: row.experimentId,
    datasetId: row.datasetId,
    status: row.status as BacktestRunStatus,
    seed: row.seed,
    codeCommit: row.codeCommit,
    configuration: jsonObject(row.configuration),
    modelVersions: row.modelVersions as Record<string, string>,
    progress: row.progress,
    totalEvents: row.totalEvents,
    ...(row.outputHash ? { outputHash: row.outputHash } : {}),
    ...(row.metrics ? { metrics: jsonObject(row.metrics) } : {}),
    ...(row.results ? { results: jsonObject(row.results) } : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.createdAt,
    ...(row.startedAt ? { startedAt: row.startedAt } : {}),
    ...(row.completedAt ? { completedAt: row.completedAt } : {}),
  };
}

export class BacktestRunService {
  constructor(private readonly database: DatabaseClient) {}

  async createExperiment(
    name: string,
    hypothesis: string,
  ): Promise<BacktestExperimentView> {
    if (!name.trim() || !hypothesis.trim())
      throw new TypeError('experiment name and hypothesis are required');
    const row = await this.database.backtestExperiment.create({
      data: { name: name.trim(), hypothesis: hypothesis.trim() },
    });
    return { ...row, runCount: 0 };
  }

  async listExperiments(): Promise<readonly BacktestExperimentView[]> {
    const rows = await this.database.backtestExperiment.findMany({
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(({ _count, ...row }) => ({
      ...row,
      runCount: _count.runs,
    }));
  }

  async queue(input: QueueBacktestRun): Promise<BacktestRunView> {
    if (!Number.isSafeInteger(input.seed))
      throw new RangeError('seed must be a safe integer');
    if (!input.codeCommit.trim()) throw new TypeError('codeCommit is required');
    for (const model of [
      'replay',
      'fill',
      'fees',
      'slippage',
      'latency',
      'rebalancing',
    ])
      if (!input.modelVersions[model]?.trim())
        throw new TypeError(`modelVersions.${model} is required`);
    const row = await this.database.backtestRun.create({
      data: {
        experimentId: input.experimentId,
        datasetId: input.datasetId,
        status: 'queued',
        seed: input.seed,
        codeCommit: input.codeCommit.trim(),
        configuration: input.configuration,
        modelVersions: input.modelVersions,
      },
    });
    return view(row);
  }

  async list(experimentId?: string): Promise<readonly BacktestRunView[]> {
    const rows = await this.database.backtestRun.findMany({
      where: experimentId ? { experimentId } : {},
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(view);
  }

  async inspect(id: string): Promise<BacktestRunView> {
    return view(
      await this.database.backtestRun.findUniqueOrThrow({ where: { id } }),
    );
  }

  async pause(id: string): Promise<BacktestRunView> {
    const current = await this.inspect(id);
    if (!['queued', 'running'].includes(current.status))
      throw new RangeError(`cannot pause a ${current.status} run`);
    return view(
      await this.database.backtestRun.update({
        where: { id },
        data:
          current.status === 'queued'
            ? { status: 'paused', pauseRequested: true }
            : { pauseRequested: true },
      }),
    );
  }

  async resume(id: string): Promise<BacktestRunView> {
    const current = await this.inspect(id);
    if (current.status !== 'paused')
      throw new RangeError(`cannot resume a ${current.status} run`);
    return view(
      await this.database.backtestRun.update({
        where: { id },
        data: {
          status: 'queued',
          pauseRequested: false,
          progress: 0,
          error: null,
        },
      }),
    );
  }

  async cancel(id: string): Promise<BacktestRunView> {
    const current = await this.inspect(id);
    if (['completed', 'failed', 'cancelled'].includes(current.status))
      throw new RangeError(`cannot cancel a ${current.status} run`);
    return view(
      await this.database.backtestRun.update({
        where: { id },
        data:
          current.status === 'running'
            ? { cancelRequested: true }
            : {
                status: 'cancelled',
                cancelRequested: true,
                completedAt: new Date(),
              },
      }),
    );
  }

  async executeNext(executor: BacktestExecutor): Promise<string | undefined> {
    const candidate = await this.database.backtestRun.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return undefined;
    const claimed = await this.database.backtestRun.updateMany({
      where: { id: candidate.id, status: 'queued' },
      data: { status: 'running', startedAt: new Date(), error: null },
    });
    if (claimed.count !== 1) return undefined;
    const run = await this.inspect(candidate.id);
    try {
      const events = await this.loadEvents(run.datasetId);
      await this.database.backtestRun.update({
        where: { id: run.id },
        data: { totalEvents: events.length },
      });
      const result = await executor(run, events, {
        checkpoint: async (processed, total) => {
          const control = await this.database.backtestRun.findUniqueOrThrow({
            where: { id: run.id },
            select: { pauseRequested: true, cancelRequested: true },
          });
          await this.database.backtestRun.update({
            where: { id: run.id },
            data: {
              progress:
                total === 0 ? 100 : Math.floor((processed * 100) / total),
            },
          });
          if (control.cancelRequested) throw new RunInterrupted('cancelled');
          if (control.pauseRequested) throw new RunInterrupted('paused');
        },
      });
      await this.database.backtestRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          progress: 100,
          outputHash: result.outputHash,
          metrics: result.metrics,
          results: result.results,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof RunInterrupted) {
        await this.database.backtestRun.update({
          where: { id: run.id },
          data: {
            status: error.status,
            completedAt: error.status === 'cancelled' ? new Date() : null,
          },
        });
      } else {
        await this.database.backtestRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            error:
              error instanceof Error
                ? error.message
                : 'unknown backtest failure',
            completedAt: new Date(),
          },
        });
      }
    }
    return run.id;
  }

  private async loadEvents(datasetId: string): Promise<ReplayEvent[]> {
    const references = await this.database.datasetEvent.findMany({
      where: { manifestId: datasetId },
      orderBy: { ordinal: 'asc' },
    });
    const envelopes = await this.database.rawMarketEnvelope.findMany({
      where: { id: { in: references.map((item) => item.sourceId) } },
    });
    const orderBooks = await this.database.marketOrderBookEvent.findMany({
      where: { rawEnvelopeId: { in: references.map((item) => item.sourceId) } },
    });
    const normalizedBooks = new Map(
      orderBooks.map((book) => [book.rawEnvelopeId, book]),
    );
    const markets = await this.database.market.findMany({
      where: { id: { in: envelopes.map((item) => item.marketId) } },
      include: { instrument: true },
    });
    const symbols = new Map(
      markets.map((market) => [market.id, market.instrument.canonicalSymbol]),
    );
    const sources = new Map(envelopes.map((item) => [item.id, item]));
    return references.map((reference) => {
      const source = sources.get(reference.sourceId);
      if (!source)
        throw new Error(`dataset source is missing: ${reference.sourceId}`);
      const book = normalizedBooks.get(source.id);
      return {
        ordinal: reference.ordinal,
        sourceId: source.id,
        eventType: source.eventType,
        marketId: source.marketId,
        venueId: source.venueId,
        ...(symbols.get(source.marketId)
          ? { canonicalSymbol: symbols.get(source.marketId) }
          : {}),
        ...(source.eventTime
          ? { eventTime: source.eventTime.toISOString() }
          : {}),
        receivedAt: source.receivedAt.toISOString(),
        payload: book
          ? {
              kind: 'orderBook',
              eventId: book.id,
              valid: true,
              bids: book.bids,
              asks: book.asks,
            }
          : source.payload,
      };
    });
  }
}

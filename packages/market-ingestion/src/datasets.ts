import type { DatabaseClient } from '@quant-lab/database';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface CreateDatasetInput {
  marketIds: readonly string[];
  from: Date;
  to: Date;
  schemaVersion?: string;
}

export interface DatasetQualityReport {
  valid: boolean;
  eventCount: number;
  coverage: Record<string, number>;
  issues: readonly DatasetQualityIssue[];
}

export interface DatasetQualityIssue {
  code:
    'book_continuity' | 'missing_event_time' | 'spread_sanity' | 'source_gap';
  severity: 'error' | 'warning';
  marketId?: string;
  details: string;
}

export interface DatasetManifestView {
  id: string;
  checksum: string;
  schemaVersion: string;
  from: Date;
  to: Date;
  eventCount: number;
  sourceCoverage: Record<string, number>;
  qualityReport?: unknown;
  createdAt: Date;
  validatedAt?: Date;
  pinnedAt?: Date;
  exportedAt?: Date;
  exportPath?: string;
  compactedAt?: Date;
  marketIds: readonly string[];
}

export interface FrozenDatasetEvent {
  ordinal: number;
  eventType: string;
  sourceId: string;
  checksum: string;
  venueId: string;
  marketId: string;
  eventTime?: string;
  receivedAt: string;
  payload: unknown;
}

interface EventReference {
  eventType: string;
  sourceId: string;
  occurredAt: Date;
  checksum: string;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function decimalParts(value: string): [bigint, bigint] {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new TypeError(`invalid positive decimal: ${value}`);
  const fraction = match[2] ?? '';
  return [BigInt(`${match[1]}${fraction}`), 10n ** BigInt(fraction.length)];
}

function decimalCompare(left: string, right: string): number {
  const [ln, ld] = decimalParts(left);
  const [rn, rd] = decimalParts(right);
  const difference = ln * rd - rn * ld;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export class HistoricalDatasetService {
  constructor(private readonly database: DatabaseClient) {}

  async create(input: CreateDatasetInput): Promise<DatasetManifestView> {
    const marketIds = [...new Set(input.marketIds)].sort();
    if (marketIds.length === 0)
      throw new TypeError('at least one market is required');
    if (input.from >= input.to)
      throw new RangeError('dataset from must be before to');
    const existingMarkets = await this.database.market.count({
      where: { id: { in: marketIds } },
    });
    if (existingMarkets !== marketIds.length)
      throw new RangeError('one or more markets do not exist');
    const envelopes = await this.database.rawMarketEnvelope.findMany({
      where: {
        marketId: { in: marketIds },
        receivedAt: { gte: input.from, lte: input.to },
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, eventType: true, receivedAt: true, checksum: true },
    });
    const references: EventReference[] = envelopes.map((row) => ({
      eventType: row.eventType,
      sourceId: row.id,
      occurredAt: row.receivedAt,
      checksum: row.checksum,
    }));
    const coverage = this.coverage(references);
    const identity = canonicalJson({
      schemaVersion: input.schemaVersion ?? '1',
      marketIds,
      from: input.from.toISOString(),
      to: input.to.toISOString(),
      events: references.map((event) => [
        event.eventType,
        event.sourceId,
        event.checksum,
      ]),
    });
    const checksum = hash(identity);
    const id = `dataset_${checksum.slice(0, 24)}`;
    const manifest = await this.database.datasetManifest.upsert({
      where: { id },
      update: {},
      create: {
        id,
        checksum,
        schemaVersion: input.schemaVersion ?? '1',
        from: input.from,
        to: input.to,
        eventCount: references.length,
        sourceCoverage: coverage,
        markets: { create: marketIds.map((marketId) => ({ marketId })) },
        events: {
          create: references.map((event, ordinal) => ({ ...event, ordinal })),
        },
      },
      include: { markets: true },
    });
    return this.view(manifest);
  }

  async inspect(id: string): Promise<DatasetManifestView> {
    const manifest = await this.database.datasetManifest.findUniqueOrThrow({
      where: { id },
      include: { markets: { orderBy: { marketId: 'asc' } } },
    });
    return this.view(manifest);
  }

  async events(
    id: string,
    limit = 100,
    afterOrdinal = -1,
  ): Promise<readonly FrozenDatasetEvent[]> {
    const bounded = Math.max(1, Math.min(limit, 1000));
    const references = await this.database.datasetEvent.findMany({
      where: { manifestId: id, ordinal: { gt: afterOrdinal } },
      orderBy: { ordinal: 'asc' },
      take: bounded,
    });
    const envelopes = await this.database.rawMarketEnvelope.findMany({
      where: { id: { in: references.map((event) => event.sourceId) } },
    });
    const byId = new Map(envelopes.map((event) => [event.id, event]));
    return references.map((reference) => {
      const source = byId.get(reference.sourceId);
      if (!source)
        throw new Error(`dataset source is missing: ${reference.sourceId}`);
      return {
        ordinal: reference.ordinal,
        eventType: reference.eventType,
        sourceId: reference.sourceId,
        checksum: reference.checksum,
        venueId: source.venueId,
        marketId: source.marketId,
        eventTime: source.eventTime?.toISOString(),
        receivedAt: source.receivedAt.toISOString(),
        payload: source.payload,
      };
    });
  }

  async validate(id: string, maxGapMs = 60_000): Promise<DatasetQualityReport> {
    const manifest = await this.database.datasetManifest.findUniqueOrThrow({
      where: { id },
      include: { events: { orderBy: { ordinal: 'asc' } }, markets: true },
    });
    const issues: DatasetQualityIssue[] = [];
    const byTypeMarket = new Map<string, Date>();
    const envelopes = await this.database.rawMarketEnvelope.findMany({
      where: { id: { in: manifest.events.map((event) => event.sourceId) } },
      select: {
        id: true,
        marketId: true,
        eventType: true,
        eventTime: true,
        receivedAt: true,
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    });
    for (const event of envelopes) {
      if (!event.eventTime)
        issues.push({
          code: 'missing_event_time',
          severity: 'warning',
          marketId: event.marketId,
          details: `${event.eventType}:${event.id}`,
        });
      const key = `${event.marketId}:${event.eventType}`;
      const previous = byTypeMarket.get(key);
      if (
        previous &&
        event.receivedAt.getTime() - previous.getTime() > maxGapMs
      )
        issues.push({
          code: 'source_gap',
          severity: 'error',
          marketId: event.marketId,
          details: `${key} gap ${event.receivedAt.getTime() - previous.getTime()}ms`,
        });
      byTypeMarket.set(key, event.receivedAt);
    }
    const crossed = await this.database.marketTicker.findMany({
      where: {
        marketId: { in: manifest.markets.map((item) => item.marketId) },
        receivedAt: { gte: manifest.from, lte: manifest.to },
        bid: { not: null },
        ask: { not: null },
      },
      select: { id: true, marketId: true, bid: true, ask: true },
    });
    for (const ticker of crossed)
      if (decimalCompare(ticker.bid!.toString(), ticker.ask!.toString()) >= 0)
        issues.push({
          code: 'spread_sanity',
          severity: 'error',
          marketId: ticker.marketId,
          details: `crossed ticker ${ticker.id}`,
        });
    const invalidations = await this.database.orderBookInvalidation.findMany({
      where: {
        marketId: { in: manifest.markets.map((item) => item.marketId) },
        detectedAt: { gte: manifest.from, lte: manifest.to },
      },
    });
    for (const invalidation of invalidations)
      issues.push({
        code: 'book_continuity',
        severity: 'error',
        marketId: invalidation.marketId,
        details: `${invalidation.reason}:${invalidation.sequence ?? 'unknown'}`,
      });
    const report: DatasetQualityReport = {
      valid: issues.every((issue) => issue.severity !== 'error'),
      eventCount: manifest.eventCount,
      coverage: manifest.sourceCoverage as Record<string, number>,
      issues,
    };
    await this.database.datasetManifest.update({
      where: { id },
      data: {
        qualityReport: {
          valid: report.valid,
          eventCount: report.eventCount,
          coverage: report.coverage,
          issues: report.issues.map((issue) => ({ ...issue })),
        },
        validatedAt: new Date(),
      },
    });
    return report;
  }

  async pin(id: string): Promise<DatasetManifestView> {
    const manifest = await this.database.datasetManifest.update({
      where: { id },
      data: { pinnedAt: new Date() },
      include: { markets: true },
    });
    return this.view(manifest);
  }

  async export(id: string, directory = 'data/exports') {
    const manifest = await this.database.datasetManifest.findUniqueOrThrow({
      where: { id },
      include: { events: { orderBy: { ordinal: 'asc' } } },
    });
    const frozenEvents: FrozenDatasetEvent[] = [];
    let afterOrdinal = -1;
    while (frozenEvents.length < manifest.eventCount) {
      const page = await this.events(id, 1000, afterOrdinal);
      if (page.length === 0) break;
      frozenEvents.push(...page);
      afterOrdinal = page.at(-1)!.ordinal;
    }
    const output = frozenEvents
      .map((event) => JSON.stringify(event))
      .join('\n');
    const targetDirectory = resolve(directory);
    await mkdir(targetDirectory, { recursive: true });
    const path = resolve(targetDirectory, `${id}.ndjson`);
    await writeFile(path, output.length > 0 ? `${output}\n` : '', 'utf8');
    await this.database.datasetManifest.update({
      where: { id },
      data: { exportPath: path, exportedAt: new Date() },
    });
    return {
      id,
      path,
      eventCount: manifest.eventCount,
      checksum: hash(output),
    };
  }

  async compact(id: string, directory?: string): Promise<DatasetManifestView> {
    const manifest = await this.inspect(id);
    if (!manifest.pinnedAt)
      throw new Error('dataset must be pinned before compaction');
    if (!manifest.exportPath) await this.export(id, directory);
    const compacted = await this.database.datasetManifest.update({
      where: { id },
      data: { compactedAt: new Date() },
      include: { markets: true },
    });
    return this.view(compacted);
  }

  private coverage(events: readonly EventReference[]): Record<string, number> {
    return events.reduce<Record<string, number>>((result, event) => {
      result[event.eventType] = (result[event.eventType] ?? 0) + 1;
      return result;
    }, {});
  }

  private view(value: {
    id: string;
    checksum: string;
    schemaVersion: string;
    from: Date;
    to: Date;
    eventCount: number;
    sourceCoverage: unknown;
    qualityReport: unknown;
    createdAt: Date;
    validatedAt: Date | null;
    pinnedAt: Date | null;
    exportedAt: Date | null;
    exportPath: string | null;
    compactedAt: Date | null;
    markets?: Array<{ marketId: string }>;
  }): DatasetManifestView {
    return {
      id: value.id,
      checksum: value.checksum,
      schemaVersion: value.schemaVersion,
      from: value.from,
      to: value.to,
      eventCount: value.eventCount,
      sourceCoverage: value.sourceCoverage as Record<string, number>,
      ...(value.qualityReport ? { qualityReport: value.qualityReport } : {}),
      createdAt: value.createdAt,
      ...(value.validatedAt ? { validatedAt: value.validatedAt } : {}),
      ...(value.pinnedAt ? { pinnedAt: value.pinnedAt } : {}),
      ...(value.exportedAt ? { exportedAt: value.exportedAt } : {}),
      ...(value.exportPath ? { exportPath: value.exportPath } : {}),
      ...(value.compactedAt ? { compactedAt: value.compactedAt } : {}),
      marketIds: value.markets?.map((market) => market.marketId).sort() ?? [],
    };
  }
}

import type { DatabaseClient } from '@quant-lab/database';

import { recordsToCsv } from './csv';
import {
  buildResearchReport,
  type ResearchRecord,
  type ResearchReport,
  type ResearchReportConfig,
  type ResearchReportWindow,
} from './report';

export interface ResearchQuery {
  from?: Date;
  to?: Date;
  canonicalSymbol?: string;
  datasetId?: string;
}

const PAGE_SIZE = 10_000;

interface ResolvedScope {
  where: Record<string, unknown>;
  window: ResearchReportWindow;
}

/**
 * Loads persisted executable-opportunity evaluations and produces the research
 * report. Scoping by a dataset manifest reuses the manifest time range and
 * markets, and rows are read in a deterministic order, so a report is
 * reproducible for a fixed manifest and detector configuration.
 */
export class ArbitrageResearchService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly config: ResearchReportConfig,
  ) {}

  async report(query: ResearchQuery = {}): Promise<ResearchReport> {
    const { records, window } = await this.load(query);
    return buildResearchReport(records, this.config, window);
  }

  async records(query: ResearchQuery = {}): Promise<readonly ResearchRecord[]> {
    return (await this.load(query)).records;
  }

  async csv(query: ResearchQuery = {}): Promise<string> {
    return recordsToCsv(await this.records(query));
  }

  private async load(
    query: ResearchQuery,
  ): Promise<{ records: ResearchRecord[]; window: ResearchReportWindow }> {
    const scope = await this.scope(query);
    const rows = [];
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const page = await this.database.executableOpportunity.findMany({
        where: scope.where,
        orderBy: [{ evaluatedAt: 'asc' }, { id: 'asc' }],
        skip,
        take: PAGE_SIZE,
      });
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    const records = rows.map((row) => ({
      canonicalSymbol: row.canonicalSymbol,
      direction: row.direction,
      classification: row.classification as ResearchRecord['classification'],
      evaluatedAt: row.evaluatedAt.toISOString(),
      ...(row.topOfBookSpread
        ? { topOfBookSpread: row.topOfBookSpread.toString() }
        : {}),
      ...(row.grossProfit ? { grossProfit: row.grossProfit.toString() } : {}),
      ...(row.feeCost ? { feeCost: row.feeCost.toString() } : {}),
      ...(row.slippageCost
        ? { slippageCost: row.slippageCost.toString() }
        : {}),
      ...(row.netProfit ? { netProfit: row.netProfit.toString() } : {}),
      buyFreshnessMs: row.buyFreshnessMs,
      sellFreshnessMs: row.sellFreshnessMs,
      crossVenueSkewMs: row.crossVenueSkewMs,
    }));
    return { records, window: scope.window };
  }

  private async scope(query: ResearchQuery): Promise<ResolvedScope> {
    const where: Record<string, unknown> = {};
    const window: ResearchReportWindow = {};
    if (query.canonicalSymbol) where.canonicalSymbol = query.canonicalSymbol;

    if (query.datasetId) {
      const manifest = await this.database.datasetManifest.findUniqueOrThrow({
        where: { id: query.datasetId },
        include: { markets: true },
      });
      const marketIds = manifest.markets.map((market) => market.marketId);
      where.evaluatedAt = { gte: manifest.from, lte: manifest.to };
      where.buyMarketId = { in: marketIds };
      where.sellMarketId = { in: marketIds };
      window.datasetId = manifest.id;
      window.from = manifest.from.toISOString();
      window.to = manifest.to.toISOString();
      return { where, window };
    }

    if (query.from || query.to) {
      where.evaluatedAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
      if (query.from) window.from = query.from.toISOString();
      if (query.to) window.to = query.to.toISOString();
    }
    return { where, window };
  }
}

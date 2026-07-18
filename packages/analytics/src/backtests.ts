import type { DatabaseClient } from '@quant-lab/database';
import {
  BacktestRunService,
  type BacktestRunView,
  type JsonObject,
} from '@quant-lab/simulation';
import Decimal from 'decimal.js';

const ExactDecimal = Decimal.clone({ precision: 80 });

export interface BacktestGateThresholds {
  minNetPnl: string;
  maxDrawdown: string;
  minFillRate: string;
  maxFalsePositiveRate: string;
}

export interface BacktestEligibilityDecision {
  eligible: boolean;
  thresholds: BacktestGateThresholds;
  reasons: readonly string[];
}

export interface BacktestComparisonRow {
  id: string;
  datasetId: string;
  status: string;
  seed: number;
  codeCommit: string;
  configuration: JsonObject;
  modelVersions: Record<string, string>;
  metrics?: JsonObject;
  eligibility: BacktestEligibilityDecision;
}

const DEFAULT_GATE: BacktestGateThresholds = {
  minNetPnl: '0',
  maxDrawdown: '0',
  minFillRate: '0.5',
  maxFalsePositiveRate: '0.75',
};

function decimalMetric(metrics: JsonObject | undefined, key: string): string {
  const value = metrics?.[key];
  return typeof value === 'string' ? value : '0';
}

function threshold(
  configuration: JsonObject,
  key: keyof BacktestGateThresholds,
): string {
  const gate = configuration.validationGate;
  if (!gate || typeof gate !== 'object' || Array.isArray(gate))
    return DEFAULT_GATE[key];
  const value = (gate as JsonObject)[key];
  return typeof value === 'string' ? value : DEFAULT_GATE[key];
}

export function evaluateBacktestGate(
  metrics: JsonObject | undefined,
  configuration: JsonObject,
): BacktestEligibilityDecision {
  const thresholds: BacktestGateThresholds = {
    minNetPnl: threshold(configuration, 'minNetPnl'),
    maxDrawdown: threshold(configuration, 'maxDrawdown'),
    minFillRate: threshold(configuration, 'minFillRate'),
    maxFalsePositiveRate: threshold(configuration, 'maxFalsePositiveRate'),
  };
  const reasons: string[] = [];
  const netPnl = decimalMetric(metrics, 'netPnl');
  const drawdown = decimalMetric(metrics, 'maxDrawdown');
  const fillRate = decimalMetric(metrics, 'fillRate');
  const falsePositiveRate = decimalMetric(metrics, 'falsePositiveRate');
  if (new ExactDecimal(netPnl).lessThanOrEqualTo(thresholds.minNetPnl))
    reasons.push(`net PnL ${netPnl} must exceed ${thresholds.minNetPnl}`);
  if (new ExactDecimal(drawdown).greaterThan(thresholds.maxDrawdown))
    reasons.push(
      `maximum drawdown ${drawdown} exceeds ${thresholds.maxDrawdown}`,
    );
  if (new ExactDecimal(fillRate).lessThan(thresholds.minFillRate))
    reasons.push(`fill rate ${fillRate} is below ${thresholds.minFillRate}`);
  if (
    new ExactDecimal(falsePositiveRate).greaterThan(
      thresholds.maxFalsePositiveRate,
    )
  )
    reasons.push(
      `false-positive rate ${falsePositiveRate} exceeds ${thresholds.maxFalsePositiveRate}`,
    );
  return { eligible: reasons.length === 0, thresholds, reasons };
}

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvValue(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  return '';
}

export class BacktestAnalyticsService {
  readonly #runs: BacktestRunService;

  constructor(database: DatabaseClient) {
    this.#runs = new BacktestRunService(database);
  }

  async inspect(id: string) {
    const run = await this.#runs.inspect(id);
    return {
      ...run,
      eligibility: evaluateBacktestGate(run.metrics, run.configuration),
    };
  }

  async compare(
    ids: readonly string[],
  ): Promise<readonly BacktestComparisonRow[]> {
    if (ids.length < 2)
      throw new RangeError('at least two run ids are required');
    const rows = await Promise.all(ids.map((id) => this.#runs.inspect(id)));
    return rows.map((run) => ({
      id: run.id,
      datasetId: run.datasetId,
      status: run.status,
      seed: run.seed,
      codeCommit: run.codeCommit,
      configuration: run.configuration,
      modelVersions: run.modelVersions,
      ...(run.metrics ? { metrics: run.metrics } : {}),
      eligibility: evaluateBacktestGate(run.metrics, run.configuration),
    }));
  }

  async sweep(
    base: Omit<Parameters<BacktestRunService['queue']>[0], 'configuration'>,
    configurations: readonly JsonObject[],
  ): Promise<readonly BacktestRunView[]> {
    if (configurations.length < 2 || configurations.length > 50)
      throw new RangeError('a sweep requires between 2 and 50 configurations');
    return Promise.all(
      configurations.map((configuration) =>
        this.#runs.queue({ ...base, configuration }),
      ),
    );
  }

  async csv(id: string): Promise<string> {
    const run = await this.#runs.inspect(id);
    const trades = run.results?.trades;
    if (!Array.isArray(trades)) return 'observedAt,canonicalSymbol,netProfit\n';
    const header = [
      'observedAt',
      'canonicalSymbol',
      'buyVenueId',
      'sellVenueId',
      'executed',
      'matchedQuantity',
      'grossProfit',
      'feeCost',
      'slippageCost',
      'rebalancingCost',
      'netProfit',
      'capitalRequired',
    ];
    const rows = trades.map((item) => {
      const trade = item as JsonObject;
      return header
        .map((column) => escapeCsv(csvValue(trade[column])))
        .join(',');
    });
    return [header.join(','), ...rows].join('\n');
  }
}

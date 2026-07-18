export interface QualityReport {
  valid: boolean;
  issues: Array<{ severity: string; code: string; details: string }>;
}

export interface Dataset {
  id: string;
  checksum: string;
  from: string;
  to: string;
  eventCount: number;
  marketIds: string[];
  qualityReport?: QualityReport;
  validatedAt?: string;
  pinnedAt?: string;
  createdAt: string;
}

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  runCount: number;
}

export interface Run {
  id: string;
  experimentId: string;
  datasetId: string;
  status: string;
  progress: number;
  seed: number;
  codeCommit: string;
  configuration: Record<string, unknown>;
  modelVersions: Record<string, string>;
  metrics?: Record<string, unknown>;
  results?: Record<string, unknown>;
  eligibility?: { eligible: boolean; reasons: string[] };
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Market {
  marketId: string;
  venueId: string;
  venueSymbol: string;
  canonicalSymbol: string;
  fee: { maker: string; taker: string };
}

export const MODEL_VERSIONS = {
  replay: '1.0.0',
  fill: 'fill-v1',
  fees: '1.0.0',
  slippage: '1.0.0',
  latency: '1.0.0',
  rebalancing: '1.0.0',
};

export const ACTIVE_STATUSES = new Set(['queued', 'running', 'paused']);

export function isUnsignedDecimal(value: string): boolean {
  return /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

export function canControl(status: string, action: string): boolean {
  if (action === 'pause') return status === 'queued' || status === 'running';
  if (action === 'resume') return status === 'paused';
  if (action === 'cancel') return ACTIVE_STATUSES.has(status);
  return false;
}

export function datasetReady(dataset?: Dataset): boolean {
  return Boolean(dataset?.pinnedAt && dataset.qualityReport?.valid);
}

export function runConfiguration(values: Record<string, string>) {
  return {
    scenario: values.scenario,
    tradeSize: values.tradeSize,
    orderType: values.orderType,
    submissionDelayMs: Number(values.submissionDelayMs),
    cancelAfterMs: Number(values.cancelAfterMs),
    feeRates: {
      BINANCE: values.binanceFee,
      KRAKEN: values.krakenFee,
    },
    slippageRate: values.slippageRate,
    inventoryRebalanceRate: values.rebalanceRate,
    fillModel: {
      version: 'fill-v1',
      allowPartialFills: values.allowPartialFills === 'true',
      queueAheadRate: values.queueAheadRate,
      marketImpactRate: values.marketImpactRate,
      maxLevelParticipationRate: values.maxLevelParticipationRate,
    },
    validationGate: {
      minNetPnl: values.minNetPnl,
      maxDrawdown: values.maxDrawdown,
      minFillRate: values.minFillRate,
      maxFalsePositiveRate: values.maxFalsePositiveRate,
    },
  };
}

import { InfoButton } from '../components/info-button';
import { formatDateTime } from '../lib/time';
import { OpportunitiesTable, type OpportunityRow } from './opportunities-table';

export const dynamic = 'force-dynamic';

interface Opportunity {
  id: string;
  canonicalSymbol: string;
  classification: 'observed' | 'rejected';
  direction: string;
  observedSpread?: string;
  rejectionReason?: string;
  evaluatedAt: string;
}

interface ExecutableOpportunity {
  id: string;
  canonicalSymbol: string;
  classification: 'executable' | 'missed' | 'observed' | 'rejected';
  direction: string;
  netProfit?: string;
  netProfitRate?: string;
  maxExecutableSize?: string;
  topOfBookSpread?: string;
  rejectionReason?: string;
  blockReason?: string;
  evaluatedAt: string;
}

interface ResearchReport {
  evaluated: number;
  apparentEdges: number;
  survivingEdges: number;
  falsePositiveRate: string;
  attribution: {
    grossProfit: string;
    feeCost: string;
    slippageCost: string;
    netProfit: string;
  };
  latency: {
    submissionDelayMs: number;
    episodes: number;
    medianDurationMs: number;
    removedByLatency: number;
    removedByLatencyRate: string;
  };
  feedQuality: { maxFreshnessMs: number };
  eligibility: { eligible: boolean; reasons: string[] };
}

interface WorkerStatus {
  state: 'idle' | 'running' | 'backoff' | 'stopped';
  cycles: number;
  lastSuccessAt?: string;
  lastError?: string;
}

async function load<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://localhost:3000'}${path}`,
      { cache: 'no-store' },
    );
    return response.ok ? ((await response.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function loadWorker(): Promise<WorkerStatus | undefined> {
  try {
    const response = await fetch(
      `${process.env.WORKER_INTERNAL_URL ?? 'http://localhost:3002'}/status`,
      { cache: 'no-store' },
    );
    return response.ok ? ((await response.json()) as WorkerStatus) : undefined;
  } catch {
    return undefined;
  }
}

function rows(
  observed: readonly Opportunity[],
  executable: readonly ExecutableOpportunity[],
): OpportunityRow[] {
  return [
    ...observed.map((item): OpportunityRow => ({
      id: item.id,
      symbol: item.canonicalSymbol,
      direction: item.direction,
      source: 'observed',
      classification: item.classification,
      evaluatedAt: item.evaluatedAt,
      spread: item.observedSpread,
      detail:
        item.classification === 'rejected'
          ? (item.rejectionReason ?? 'Sin motivo informado')
          : 'Spread bruto entre venues',
    })),
    ...executable.map((item): OpportunityRow => ({
      id: item.id,
      symbol: item.canonicalSymbol,
      direction: item.direction,
      source: 'executable',
      classification: item.classification,
      evaluatedAt: item.evaluatedAt,
      spread: item.topOfBookSpread,
      netProfit: item.netProfit,
      detail:
        item.classification === 'executable'
          ? `Tasa ${item.netProfitRate ?? '—'} · tamaño ${item.maxExecutableSize ?? '—'}`
          : (item.blockReason ?? item.rejectionReason ?? 'Sin ventaja neta'),
    })),
  ];
}

export default async function OpportunitiesPage() {
  const [observed, executable, report, worker] = await Promise.all([
    load<Opportunity[]>('/opportunities?limit=500', []),
    load<ExecutableOpportunity[]>('/executable-opportunities?limit=500', []),
    load<ResearchReport | undefined>('/research/report', undefined),
    loadWorker(),
  ]);

  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="overline">INVESTIGACIÓN / CROSS-VENUE</span>
          <h1>Oportunidades</h1>
          <p>
            Spreads observados y su viabilidad después de costos y
            restricciones.
          </p>
        </div>
        <InfoButton title="Cómo interpretar oportunidades">
          <p>
            <strong>Observed</strong> indica spread bruto, no ganancia.{' '}
            <strong>Executable</strong> sobrevivió fees, profundidad, slippage y
            restricciones bajo la configuración actual.
          </p>
          <p>
            <strong>Missed</strong> fue bloqueada por tamaño, inventario o
            reglas. <strong>Rejected</strong> significa que los datos no fueron
            aptos para evaluar.
          </p>
        </InfoButton>
      </section>

      <section className="summary-grid">
        <article>
          <span>WORKER</span>
          <strong>{worker?.state ?? 'offline'}</strong>
          <small>
            {worker?.lastSuccessAt
              ? `Último ciclo ${formatDateTime(worker.lastSuccessAt)}`
              : (worker?.lastError ?? 'Sin ciclos exitosos')}
          </small>
        </article>
        <article>
          <span>EVALUACIONES</span>
          <strong>{observed.length + executable.length}</strong>
          <small>{executable.length} con modelo ejecutable</small>
        </article>
        <article>
          <span>FALSE POSITIVE</span>
          <strong>{report?.falsePositiveRate ?? '—'}</strong>
          <small>
            {report
              ? `${report.survivingEdges}/${report.apparentEdges} sobreviven`
              : 'Reporte no disponible'}
          </small>
        </article>
        <article>
          <span>NETO ACUMULADO</span>
          <strong>{report?.attribution.netProfit ?? '—'}</strong>
          <small>
            {report?.eligibility.eligible
              ? 'Dataset listo para backtest'
              : 'Gate no aprobado'}
          </small>
        </article>
      </section>

      <OpportunitiesTable rows={rows(observed, executable)} />
    </main>
  );
}

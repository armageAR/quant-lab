import { InfoButton } from '../components/info-button';
import { formatDateTime } from '../lib/time';

interface Eligibility {
  eligible: boolean;
  reasons: string[];
}

interface BacktestRun {
  id: string;
  datasetId: string;
  status: string;
  seed: number;
  codeCommit: string;
  progress: number;
  configuration: Record<string, unknown>;
  modelVersions: Record<string, string>;
  metrics?: Record<string, string | number>;
  results?: { trades?: Array<Record<string, unknown>> };
  eligibility?: Eligibility;
  error?: string;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

async function loadRuns(): Promise<BacktestRun[]> {
  const api = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
  try {
    const response = await fetch(`${api}/backtests/runs`, {
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const runs = (await response.json()) as BacktestRun[];
    return Promise.all(
      runs.map(async (run) => {
        const detail = await fetch(`${api}/backtests/runs/${run.id}`, {
          cache: 'no-store',
        });
        return detail.ok ? ((await detail.json()) as BacktestRun) : run;
      }),
    );
  } catch {
    return [];
  }
}

function metric(run: BacktestRun, key: string): string {
  return String(run.metrics?.[key] ?? '—');
}

function evidence(run: BacktestRun): string {
  const first = run.results?.trades?.[0];
  if (!first) return 'No execution evidence recorded.';
  const buy = first.buyFill as
    { evidence?: { bookEventId?: string } } | undefined;
  const sell = first.sellFill as
    { evidence?: { bookEventId?: string } } | undefined;
  return `BUY ${buy?.evidence?.bookEventId ?? '—'} / SELL ${sell?.evidence?.bookEventId ?? '—'}`;
}

export default async function BacktestsPage() {
  const runs = await loadRuns();
  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="overline">SIMULACIÓN / HISTORICAL REPLAY</span>
          <h1>Backtests</h1>
          <p>Resultados ligados a dataset, commit, seed y modelos.</p>
        </div>
        <InfoButton title="Cómo interpretar un backtest">
          <p>
            Priorizá net PnL, drawdown, fill rate y falsos positivos. Un
            resultado base positivo no alcanza: debe sostenerse con supuestos
            conservadores y adversos.
          </p>
          <p>
            El gate solo habilita la siguiente etapa de validación; nunca
            autoriza trading real.
          </p>
        </InfoButton>
      </section>
      {runs.length === 0 ? (
        <section className="status">
          <article>
            <span className="index">00</span>
            <div>
              <h2>No backtest runs yet</h2>
              <p>Create an experiment and queue a run through the API.</p>
            </div>
            <span className="badge">IDLE</span>
          </article>
        </section>
      ) : (
        <section className="backtest-grid" aria-label="Backtest runs">
          {runs.map((run) => (
            <article className="backtest-card" key={run.id}>
              <div className="backtest-card-head">
                <span className="index">{run.id.slice(0, 8)}</span>
                <span
                  className={`badge ${run.eligibility?.eligible ? 'executable' : ''}`}
                >
                  {run.status} / {run.progress}%
                </span>
              </div>
              <h2>{run.datasetId}</h2>
              <p>
                COMMIT {run.codeCommit.slice(0, 12)} · SEED {run.seed} · MODELS{' '}
                {Object.values(run.modelVersions).join(' / ')}
              </p>
              <p className="run-time">
                CREACIÓN {formatDateTime(run.createdAt)} · INICIO{' '}
                {formatDateTime(run.startedAt)} · FIN{' '}
                {formatDateTime(run.completedAt)} · GMT-3
              </p>
              <div className="metric-strip">
                <span>NET {metric(run, 'netPnl')}</span>
                <span>DD {metric(run, 'maxDrawdown')}</span>
                <span>FILL {metric(run, 'fillRate')}</span>
                <span>FP {metric(run, 'falsePositiveRate')}</span>
              </div>
              <details>
                <summary>Assumptions and evidence</summary>
                <pre>{JSON.stringify(run.configuration, null, 2)}</pre>
                <p>{evidence(run)}</p>
              </details>
              {run.eligibility ? (
                <p className="gate-copy">
                  {run.eligibility.eligible
                    ? 'Eligible for paper-trading validation.'
                    : run.eligibility.reasons.join('; ')}
                </p>
              ) : null}
              {run.error ? <p className="gate-copy">{run.error}</p> : null}
            </article>
          ))}
        </section>
      )}
      <footer>
        <span>EXECUTION</span>
        <strong>SIMULATED ONLY</strong>
      </footer>
    </main>
  );
}

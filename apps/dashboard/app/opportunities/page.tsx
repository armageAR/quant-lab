export const dynamic = 'force-dynamic';

interface Opportunity {
  id: string;
  canonicalSymbol: string;
  classification: 'observed' | 'rejected';
  direction: string;
  observedSpread?: string;
  rejectionReason?: string;
  evaluatedAt: string;
  buyBookEventId: string;
  sellBookEventId: string;
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

interface WorkerStatus {
  enabled: boolean;
  state: 'idle' | 'running' | 'backoff' | 'stopped';
  cycles: number;
  lastSuccessAt?: string;
  lastError?: string;
  nextRunAt?: string;
}

async function loadOpportunities(): Promise<readonly Opportunity[]> {
  const api = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
  try {
    const response = await fetch(`${api}/opportunities?limit=100`, {
      cache: 'no-store',
    });
    if (!response.ok) return [];
    return (await response.json()) as Opportunity[];
  } catch {
    return [];
  }
}

async function loadExecutableOpportunities(): Promise<
  readonly ExecutableOpportunity[]
> {
  const api = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
  try {
    const response = await fetch(`${api}/executable-opportunities?limit=100`, {
      cache: 'no-store',
    });
    if (!response.ok) return [];
    return (await response.json()) as ExecutableOpportunity[];
  } catch {
    return [];
  }
}

async function loadWorkerStatus(): Promise<WorkerStatus | undefined> {
  const worker = process.env.WORKER_INTERNAL_URL ?? 'http://localhost:3002';
  try {
    const response = await fetch(`${worker}/status`, { cache: 'no-store' });
    if (!response.ok) return undefined;
    return (await response.json()) as WorkerStatus;
  } catch {
    return undefined;
  }
}

export default async function OpportunitiesPage() {
  const [opportunities, executable, worker] = await Promise.all([
    loadOpportunities(),
    loadExecutableOpportunities(),
    loadWorkerStatus(),
  ]);
  return (
    <main>
      <header>
        <span className="eyebrow">QUANT LAB / RESEARCH</span>
        <a className="phase" href="/">
          PLATFORM
        </a>
      </header>
      <section className="hero compact">
        <p className="kicker">Cross-venue evidence, not execution claims.</p>
        <h1>Observed and executable edges.</h1>
        <p className="lede">
          Fresh Binance and Kraken books aligned by instrument. Observed edges
          record raw spreads; executable edges apply fees, order-book depth,
          venue rules and configured inventory to estimate realizable net
          profit.
        </p>
      </section>
      <section className="status" aria-label="Observation worker status">
        <article>
          <div>
            <h2>Automatic observation</h2>
            <p>
              {worker?.lastError
                ? `Last error: ${worker.lastError}`
                : worker?.lastSuccessAt
                  ? `Last successful cycle ${worker.lastSuccessAt}`
                  : 'Waiting for the first successful cycle.'}
            </p>
          </div>
          <span
            className={`badge ${worker?.state === 'idle' ? 'observed' : ''}`}
          >
            {worker ? worker.state.toUpperCase() : 'OFFLINE'}
          </span>
        </article>
      </section>
      <section
        className="status opportunity-list"
        aria-label="Observed opportunities"
      >
        {opportunities.length === 0 ? (
          <article>
            <div>
              <h2>No evaluations yet</h2>
              <p>
                Start `pnpm dev`; the worker will ingest and evaluate configured
                markets automatically.
              </p>
            </div>
            <span className="badge">IDLE</span>
          </article>
        ) : (
          opportunities.map((item, index) => (
            <article key={item.id}>
              <span className="index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h2>
                  {item.canonicalSymbol} / {item.direction}
                </h2>
                <p>
                  {item.classification === 'observed'
                    ? `Observed spread ${item.observedSpread}`
                    : `Rejected: ${item.rejectionReason}`}
                </p>
                <small>
                  {item.buyBookEventId.slice(0, 8)} /{' '}
                  {item.sellBookEventId.slice(0, 8)} · {item.evaluatedAt}
                </small>
              </div>
              <span className={`badge ${item.classification}`}>
                {item.classification.toUpperCase()}
              </span>
            </article>
          ))
        )}
      </section>
      <section
        className="status opportunity-list"
        aria-label="Executable opportunities"
      >
        <article>
          <div>
            <h2>Executable evaluation</h2>
            <p>
              Net profit after fees, depth, venue constraints and configured
              inventory. Profit is reported only for executable classifications.
            </p>
          </div>
          <span className="badge">SPRINT 3.2</span>
        </article>
        {executable.length === 0 ? (
          <article>
            <div>
              <h2>No executable evaluations yet</h2>
              <p>
                Enable `EXECUTABLE_DETECTOR_ENABLED` or run `pnpm
                opportunity:detect:executable` to populate this view.
              </p>
            </div>
            <span className="badge">IDLE</span>
          </article>
        ) : (
          executable.map((item, index) => (
            <article key={item.id}>
              <span className="index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h2>
                  {item.canonicalSymbol} / {item.direction}
                </h2>
                <p>
                  {item.classification === 'executable'
                    ? `Net ${item.netProfit} (${item.netProfitRate}) · max size ${item.maxExecutableSize}`
                    : item.classification === 'missed'
                      ? `Missed: ${item.blockReason}`
                      : item.classification === 'rejected'
                        ? `Rejected: ${item.rejectionReason}`
                        : `Observed spread ${item.topOfBookSpread}, no net edge`}
                </p>
                <small>{item.evaluatedAt}</small>
              </div>
              <span className={`badge ${item.classification}`}>
                {item.classification.toUpperCase()}
              </span>
            </article>
          ))
        )}
      </section>
      <footer>
        <span>EXECUTABILITY</span>
        <strong>
          {executable.some((item) => item.classification === 'executable')
            ? 'EVALUATED'
            : 'NO NET EDGE'}
        </strong>
      </footer>
    </main>
  );
}

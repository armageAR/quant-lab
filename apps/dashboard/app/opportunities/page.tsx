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

export default async function OpportunitiesPage() {
  const opportunities = await loadOpportunities();
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
        <h1>Observed edges.</h1>
        <p className="lede">
          Fresh Binance and Kraken books aligned by instrument. Fees, depth and
          execution constraints are intentionally deferred to Sprint 3.2.
        </p>
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
                Run `pnpm opportunity:detect` after fresh order-book ingestion.
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
      <footer>
        <span>EXECUTABILITY</span>
        <strong>NOT EVALUATED</strong>
      </footer>
    </main>
  );
}

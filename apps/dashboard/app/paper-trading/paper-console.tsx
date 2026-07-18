'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '../lib/time';
import { InfoButton } from '../components/info-button';

interface Account {
  id: string;
  venueId: string;
  asset: string;
  available: string;
  reserved: string;
}
interface Alert {
  id: string;
  severity: string;
  code: string;
  message: string;
  createdAt: string;
  resolvedAt?: string;
}
interface Campaign {
  id: string;
  name: string;
  status: string;
  decision?: string;
}
interface Session {
  id: string;
  name: string;
  status: string;
  strategyVersion: string;
  codeCommit: string;
  accounts: Account[];
  alerts: Alert[];
  campaigns: Campaign[];
  _count?: { orders: number };
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, init);
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  if (!response.ok)
    throw new Error(body.message ?? `Request failed (${response.status})`);
  return body as T;
}

export function PaperConsole({
  initialSessions,
  commitSha,
}: {
  initialSessions: unknown[];
  commitSha: string;
}) {
  const [sessions, setSessions] = useState(initialSessions as Session[]);
  const [selectedId, setSelectedId] = useState(
    (initialSessions[0] as Session | undefined)?.id ?? '',
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(initialSessions.length === 0);
  const selected = sessions.find((session) => session.id === selectedId);
  const refresh = async () => {
    try {
      const rows = await request<Session[]>('/paper-trading/sessions');
      setSessions(rows);
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    } catch {
      /* preserve current operator context */
    }
  };
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  });
  const mutate = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await work();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  };
  const control = (action: string) =>
    void mutate(async () => {
      if (!selected) throw new Error('Select a session.');
      if (
        (action === 'stop' || action === 'emergency-stop') &&
        !window.confirm(`${action} this paper session?`)
      )
        return;
      await request(`/paper-trading/sessions/${selected.id}/${action}`, {
        method: 'POST',
      });
      setMessage(`${action} confirmed by server.`);
    });
  return (
    <main className="paper-console">
      <section className="page-heading compact-heading">
        <div>
          <span className="overline">NO EXCHANGE ORDERS</span>
          <h1>Paper trading</h1>
          <p>
            Inventario, riesgo y campaña con ejecución exclusivamente simulada.
          </p>
        </div>
        <InfoButton title="Safety boundary">
          <p>
            Paper trading consumes market evidence but never calls exchange
            order endpoints. Emergency stop is persistent.
          </p>
        </InfoButton>
      </section>
      <p className="live-message" role="status">
        {busy ? 'Processing…' : message}
      </p>
      <section className="workspace-panel">
        <div className="panel-head">
          <h2>Operator lifecycle</h2>
          <div className="panel-actions">
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} · {session.status}
                </option>
              ))}
            </select>
            <button className="button" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
        </div>
        <button
          className="button secondary"
          onClick={() => setCreating((value) => !value)}
        >
          {creating ? 'Cancel new session' : 'New session'}
        </button>
        {selected && !creating ? (
          <>
            <div className="paper-status">
              <article>
                <span>Status</span>
                <strong>{selected.status}</strong>
              </article>
              <article>
                <span>Orders</span>
                <strong>{selected._count?.orders ?? 0}</strong>
              </article>
              <article>
                <span>Strategy</span>
                <strong>{selected.strategyVersion}</strong>
              </article>
              <article>
                <span>Commit</span>
                <strong>{selected.codeCommit.slice(0, 12)}</strong>
              </article>
            </div>
            <div className="panel-actions">
              <button
                className="button"
                disabled={
                  busy || !['draft', 'paused'].includes(selected.status)
                }
                onClick={() => control('start')}
              >
                Start
              </button>
              <button
                className="button secondary"
                disabled={busy || selected.status !== 'running'}
                onClick={() => control('pause')}
              >
                Pause
              </button>
              <button
                className="button secondary"
                disabled={
                  busy || !['running', 'paused'].includes(selected.status)
                }
                onClick={() => control('stop')}
              >
                Stop
              </button>
              <button
                className="button danger"
                disabled={
                  busy ||
                  ['stopped', 'emergency_stopped'].includes(selected.status)
                }
                onClick={() => control('emergency-stop')}
              >
                Emergency stop
              </button>
            </div>
          </>
        ) : (
          <SessionForm
            commitSha={commitSha}
            busy={busy}
            create={(body) =>
              void mutate(async () => {
                const created = await request<Session>(
                  '/paper-trading/sessions',
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(body),
                  },
                );
                setSelectedId(created.id);
                setCreating(false);
              })
            }
          />
        )}
      </section>
      {selected && (
        <>
          <section className="workspace-panel paper-section">
            <h2>Venue balances</h2>
            <div className="table-scroll">
              <table className="paper-table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Asset</th>
                    <th>Available</th>
                    <th>Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.accounts
                    .filter((account) => !account.venueId.startsWith('SYSTEM:'))
                    .map((account) => (
                      <tr key={account.id}>
                        <td>{account.venueId}</td>
                        <td>{account.asset}</td>
                        <td className="numeric">{account.available}</td>
                        <td className="numeric">{account.reserved}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="workspace-panel paper-section">
            <h2>Risk alerts</h2>
            {selected.alerts.length ? (
              selected.alerts.map((alert) => (
                <article className="paper-alert" key={alert.id}>
                  <span className="badge rejected">
                    {alert.severity} · {alert.code}
                  </span>
                  <strong>{alert.message}</strong>
                  <small>{formatDateTime(alert.createdAt)} GMT-3</small>
                </article>
              ))
            ) : (
              <p>No risk blocks or reconciliation alerts.</p>
            )}
          </section>
          <CampaignPanel session={selected} busy={busy} mutate={mutate} />
        </>
      )}
      <footer>
        <span>EXECUTION PROVIDER</span>
        <strong>PAPER ONLY</strong>
      </footer>
    </main>
  );
}

function SessionForm({
  commitSha,
  busy,
  create,
}: {
  commitSha: string;
  busy: boolean;
  create: (body: unknown) => void;
}) {
  const [name, setName] = useState('Spot paper campaign');
  const [commit, setCommit] = useState(commitSha);
  return (
    <form
      className="paper-create"
      onSubmit={(event) => {
        event.preventDefault();
        create({
          name,
          strategyVersion: 'arbitrage-paper-v1',
          codeCommit: commit,
          initialBalances: {
            BINANCE: { BTC: '1', USD: '10000', USDT: '10000' },
            KRAKEN: { BTC: '1', USD: '10000', USDT: '10000' },
          },
          limits: {
            maximumOrderNotional: '100',
            maximumVenueExposure: '25000',
            maximumDailyLoss: '100',
            maximumFeedAgeMs: 5000,
            maximumInventoryImbalance: '0.25',
          },
        });
      }}
    >
      <label>
        Name
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Commit SHA
        <input
          required
          value={commit}
          onChange={(event) => setCommit(event.target.value)}
        />
      </label>
      <p>
        Initial inventory: 1 BTC + 10,000 USD/USDT per venue. Maximum simulated
        order: 100 quote units.
      </p>
      <button className="button" disabled={busy}>
        Create paper session
      </button>
    </form>
  );
}
function CampaignPanel({
  session,
  busy,
  mutate,
}: {
  session: Session;
  busy: boolean;
  mutate: (work: () => Promise<void>) => Promise<void>;
}) {
  const [report, setReport] = useState<unknown>();
  const campaign = session.campaigns[0];
  return (
    <section className="workspace-panel paper-section">
      <div className="panel-head">
        <h2>Validation campaign</h2>
        {!campaign ? (
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void mutate(async () => {
                await request(
                  `/paper-trading/sessions/${session.id}/campaigns`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      name: 'Phase 5 live-feed validation',
                      minimumDurationHours: 72,
                      minimumSampleCount: 100,
                    }),
                  },
                );
              })
            }
          >
            Start 72h / 100 sample campaign
          </button>
        ) : (
          <div className="panel-actions">
            <button
              className="button secondary"
              onClick={() =>
                void mutate(async () =>
                  setReport(
                    await request(
                      `/paper-trading/campaigns/${campaign.id}/report`,
                    ),
                  ),
                )
              }
            >
              Evaluate
            </button>
            <button
              className="button"
              onClick={() =>
                void mutate(async () =>
                  setReport(
                    await request(
                      `/paper-trading/campaigns/${campaign.id}/report?finalize=true`,
                    ),
                  ),
                )
              }
            >
              Finalize no-auto-promotion report
            </button>
          </div>
        )}
      </div>
      {campaign && (
        <p>
          {campaign.name} · {campaign.status} ·{' '}
          {campaign.decision ?? 'pending decision'}
        </p>
      )}
      {Boolean(report) && (
        <pre className="comparison-json">{JSON.stringify(report, null, 2)}</pre>
      )}
    </section>
  );
}

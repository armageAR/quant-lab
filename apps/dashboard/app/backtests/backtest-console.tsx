'use client';

import { useEffect, useState } from 'react';

import { InfoButton } from '../components/info-button';
import { Modal } from '../components/modal';
import { formatDateTime } from '../lib/time';
import {
  ACTIVE_STATUSES,
  canControl,
  datasetReady,
  isUnsignedDecimal,
  MODEL_VERSIONS,
  runConfiguration,
  type Dataset,
  type Experiment,
  type Market,
  type Run,
} from './model';

const defaults: Record<string, string> = {
  scenario: 'base',
  tradeSize: '100',
  orderType: 'market',
  submissionDelayMs: '25',
  cancelAfterMs: '5000',
  binanceFee: '0.001',
  krakenFee: '0.0026',
  slippageRate: '0.0002',
  rebalanceRate: '0',
  allowPartialFills: 'true',
  queueAheadRate: '0.25',
  marketImpactRate: '0.0001',
  maxLevelParticipationRate: '0.25',
  minNetPnl: '0',
  maxDrawdown: '10',
  minFillRate: '0.5',
  maxFalsePositiveRate: '0.75',
  seed: '1',
  codeCommit: '',
};
const decimalFields = [
  'tradeSize',
  'binanceFee',
  'krakenFee',
  'slippageRate',
  'rebalanceRate',
  'queueAheadRate',
  'marketImpactRate',
  'maxLevelParticipationRate',
  'minNetPnl',
  'maxDrawdown',
  'minFillRate',
  'maxFalsePositiveRate',
];

function display(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '—';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, init);
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  if (!response.ok)
    throw new Error(payload.message ?? `Request failed (${response.status})`);
  return payload as T;
}

export function BacktestConsole(props: {
  initialDatasets: Dataset[];
  initialExperiments: Experiment[];
  initialRuns: Run[];
  markets: Market[];
  commitSha: string;
}) {
  const [tab, setTab] = useState('runs');
  const [datasets, setDatasets] = useState(props.initialDatasets);
  const [experiments, setExperiments] = useState(props.initialExperiments);
  const [runs, setRuns] = useState(props.initialRuns);
  const [datasetId, setDatasetId] = useState(
    props.initialDatasets.find(datasetReady)?.id ?? '',
  );
  const [experimentId, setExperimentId] = useState(
    props.initialExperiments[0]?.id ?? '',
  );
  const [values, setValues] = useState<Record<string, string>>({
    ...defaults,
    codeCommit: props.commitSha,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<unknown>();
  const [review, setReview] = useState<unknown>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const refreshRuns = async () => {
    try {
      setRuns(await request<Run[]>('/backtests/runs'));
      setMessage('');
    } catch {
      /* polling errors are transient — keep current state */
    }
  };
  useEffect(() => {
    if (!runs.some((run) => ACTIVE_STATUSES.has(run.status))) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshRuns();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [runs]);

  const mutate = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  };
  const payload = () => ({
    experimentId,
    datasetId,
    seed: Number(values.seed),
    codeCommit: values.codeCommit,
    configuration: runConfiguration(values),
    modelVersions: MODEL_VERSIONS,
  });
  const requestError = () => {
    const dataset = datasets.find((item) => item.id === datasetId);
    if (!datasetReady(dataset))
      return 'Validate and pin the selected dataset before queueing.';
    if (!experimentId || !(values.codeCommit ?? '').trim())
      return 'Experiment and commit SHA are required.';
    if (decimalFields.some((field) => !isUnsignedDecimal(values[field] ?? '')))
      return 'Financial values must be unsigned plain decimals.';
    if (
      ![values.submissionDelayMs, values.cancelAfterMs, values.seed].every(
        (item) => /^\d+$/.test(item ?? ''),
      )
    )
      return 'Delay, cancellation and seed must be integers.';
    return undefined;
  };
  const reviewRun = () => {
    const error = requestError();
    if (error) return setMessage(error);
    setReview(payload());
  };
  const queue = () =>
    mutate(async () => {
      const reviewed = review as {
        sweep?: boolean;
        request?: ReturnType<typeof payload>;
      };
      if (reviewed.sweep && reviewed.request) {
        const { configuration, ...rest } = reviewed.request;
        const queued = await request<Run[]>('/backtests/sweeps', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...rest,
            configurations: ['base', 'conservative', 'adverse'].map(
              (scenario) => ({ ...configuration, scenario }),
            ),
          }),
        });
        setRuns((current) => [...queued, ...current]);
        setReview(undefined);
        setTab('runs');
        setMessage(`${queued.length} scenario runs queued.`);
        return;
      }
      const run = await request<Run>('/backtests/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(review),
      });
      setRuns((current) => [run, ...current]);
      setReview(undefined);
      setTab('runs');
      setMessage(`Run ${run.id} queued.`);
    });
  const reviewSweep = () => {
    const error = requestError();
    if (error) return setMessage(error);
    setReview({ sweep: true, estimatedRuns: 3, request: payload() });
  };
  const control = (run: Run, action: string) =>
    mutate(async () => {
      if (!canControl(run.status, action))
        throw new Error(`Cannot ${action} a ${run.status} run.`);
      if (action === 'cancel' && !window.confirm('Cancel this run?')) return;
      const updated = await request<Run>(
        `/backtests/runs/${run.id}/${action}`,
        { method: 'POST' },
      );
      setRuns((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    });
  const compare = () =>
    mutate(async () => {
      if (selected.length < 2)
        throw new Error('Select at least 2 runs to compare.');
      setComparison(undefined);
      const result = await request(
        `/backtests/compare?ids=${selected.slice(0, 10).join(',')}`,
      );
      setComparison(result);
      setTab('compare');
    });

  return (
    <main className="backtest-console">
      <section className="page-heading compact-heading">
        <div>
          <span className="overline">SIMULATED EXECUTION ONLY</span>
          <h1>Backtest operations</h1>
        </div>
        <InfoButton title="Backtest workflow">
          <p>
            Prepare a validated, pinned dataset; document the hypothesis; queue
            deterministic runs; compare net results and export evidence.
          </p>
          <p>This console cannot place paper or live orders.</p>
        </InfoButton>
      </section>
      <nav className="workspace-tabs" aria-label="Backtest workspace">
        {['datasets', 'experiments', 'configure', 'runs', 'compare'].map(
          (item) => (
            <button
              key={item}
              aria-current={tab === item ? 'page' : undefined}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ),
        )}
      </nav>
      <p className="live-message" role="status" aria-live="polite">
        {busy ? 'Processing…' : message}
      </p>

      {tab === 'datasets' && (
        <DatasetWorkspace
          datasets={datasets}
          markets={props.markets}
          busy={busy}
          onChange={setDatasets}
          mutate={mutate}
        />
      )}
      {tab === 'experiments' && (
        <ExperimentWorkspace
          experiments={experiments}
          busy={busy}
          onChange={setExperiments}
          mutate={mutate}
          onSelect={(id) => {
            setExperimentId(id);
            setTab('configure');
          }}
        />
      )}
      {tab === 'configure' && (
        <section className="workspace-panel">
          <h2>Run configuration</h2>
          <div className="form-grid">
            <Field label="Dataset">
              <select
                value={datasetId}
                onChange={(event) => setDatasetId(event.target.value)}
              >
                <option value="">Select…</option>
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {datasetReady(dataset) ? 'READY' : 'BLOCKED'} · {dataset.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Experiment">
              <select
                value={experimentId}
                onChange={(event) => setExperimentId(event.target.value)}
              >
                <option value="">Select…</option>
                {experiments.map((experiment) => (
                  <option key={experiment.id} value={experiment.id}>
                    {experiment.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Scenario">
              <select
                value={values.scenario}
                onChange={(event) =>
                  setValues({ ...values, scenario: event.target.value })
                }
              >
                {['base', 'conservative', 'adverse'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Order type">
              <select
                value={values.orderType}
                onChange={(event) =>
                  setValues({ ...values, orderType: event.target.value })
                }
              >
                <option>market</option>
                <option>limit</option>
              </select>
            </Field>
            <Field label="Partial fills">
              <select
                value={values.allowPartialFills}
                onChange={(event) =>
                  setValues({
                    ...values,
                    allowPartialFills: event.target.value,
                  })
                }
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </Field>
            {Object.entries(values)
              .filter(
                ([key]) =>
                  !['scenario', 'orderType', 'allowPartialFills'].includes(key),
              )
              .map(([key, value]) => (
                <Field key={key} label={key}>
                  <input
                    required
                    value={value}
                    inputMode={decimalFields.includes(key) ? 'decimal' : 'text'}
                    onChange={(event) =>
                      setValues({ ...values, [key]: event.target.value })
                    }
                  />
                </Field>
              ))}
          </div>
          <div className="panel-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={reviewSweep}
            >
              Review 3-scenario sweep
            </button>
            <button className="button" disabled={busy} onClick={reviewRun}>
              Review immutable request
            </button>
          </div>
        </section>
      )}
      {tab === 'runs' && (
        <section className="workspace-panel">
          <div className="panel-head">
            <h2>Run queue</h2>
            <div className="panel-actions">
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All states</option>
                {[
                  'queued',
                  'running',
                  'paused',
                  'completed',
                  'failed',
                  'cancelled',
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <button
                className="button secondary"
                onClick={() => {
                  setStatusFilter('all');
                  setSelected([]);
                }}
              >
                Reset
              </button>
              <button className="button" onClick={() => void refreshRuns()}>
                Refresh
              </button>
              <button
                className="button"
                disabled={selected.length < 2}
                onClick={compare}
              >
                Compare ({selected.length})
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="backtest-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Status</th>
                  <th>Experiment / dataset</th>
                  <th>Scenario</th>
                  <th>Created GMT-3</th>
                  <th>Net / drawdown / fills</th>
                  <th>Controls</th>
                </tr>
              </thead>
              <tbody>
                {runs
                  .filter(
                    (run) =>
                      statusFilter === 'all' || run.status === statusFilter,
                  )
                  .map((run) => (
                    <tr key={run.id}>
                      <td>
                        <input
                          aria-label={`Select ${run.id}`}
                          type="checkbox"
                          checked={selected.includes(run.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, run.id].slice(0, 10)
                                : selected.filter((id) => id !== run.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <span
                          className={`badge ${run.status === 'completed' ? 'executable' : ''}`}
                        >
                          {run.status} {run.progress}%
                        </span>
                        {run.error && <small>{run.error}</small>}
                      </td>
                      <td>
                        <strong>
                          {experiments.find((x) => x.id === run.experimentId)
                            ?.name ?? run.experimentId}
                        </strong>
                        <small>{run.datasetId}</small>
                      </td>
                      <td>{display(run.configuration.scenario)}</td>
                      <td>{formatDateTime(run.createdAt)}</td>
                      <td>
                        <Metrics run={run} />
                      </td>
                      <td>
                        <div className="row-actions">
                          {['pause', 'resume', 'cancel'].map(
                            (action) =>
                              canControl(run.status, action) && (
                                <button
                                  key={action}
                                  onClick={() => void control(run, action)}
                                >
                                  {action}
                                </button>
                              ),
                          )}
                          <a
                            href={`/api/backend/backtests/runs/${run.id}/export.csv`}
                          >
                            CSV
                          </a>
                        </div>
                        <details>
                          <summary>Details</summary>
                          <pre>{JSON.stringify(run, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === 'compare' && (
        <section className="workspace-panel">
          <h2>Comparison</h2>
          {comparison ? (
            <pre className="comparison-json">
              {JSON.stringify(comparison, null, 2)}
            </pre>
          ) : (
            <p>
              Select 2–10 runs in Run queue. Runs from different datasets are
              not directly comparable.
            </p>
          )}
        </section>
      )}
      <footer>
        <span>EXECUTION</span>
        <strong>SIMULATED ONLY</strong>
      </footer>
      <Modal
        open={Boolean(review)}
        title="Confirm immutable run request"
        onClose={() => setReview(undefined)}
      >
        <pre className="review-json">{JSON.stringify(review, null, 2)}</pre>
        <div className="panel-actions">
          <button
            className="button secondary"
            onClick={() => setReview(undefined)}
          >
            Edit
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={() => void queue()}
          >
            Queue run
          </button>
        </div>
      </Modal>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Metrics({ run }: { run: Run }) {
  const m = run.metrics ?? {};
  return (
    <span className="metric-cell">
      NET {display(m.netPnl)} · DD {display(m.maxDrawdown)} · FILL{' '}
      {display(m.fillRate)}
      <small>
        {run.eligibility
          ? run.eligibility.eligible
            ? 'Gate passed'
            : run.eligibility.reasons.join('; ')
          : 'Pending'}
      </small>
    </span>
  );
}

function DatasetWorkspace({
  datasets,
  markets,
  busy,
  onChange,
  mutate,
}: {
  datasets: Dataset[];
  markets: Market[];
  busy: boolean;
  onChange: (items: Dataset[]) => void;
  mutate: (work: () => Promise<void>) => Promise<void>;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const reload = async () =>
    onChange(await request<Dataset[]>('/datasets?limit=200'));
  return (
    <section className="workspace-panel">
      <div className="panel-head">
        <h2>Historical datasets</h2>
        <button className="button" onClick={() => void mutate(reload)}>
          Refresh
        </button>
      </div>
      <form
        className="dataset-create"
        onSubmit={(e) => {
          e.preventDefault();
          void mutate(async () => {
            await request('/datasets', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                marketIds: chosen,
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
              }),
            });
            await reload();
          });
        }}
      >
        <Field label="Comparable markets">
          <select
            multiple
            required
            value={chosen}
            onChange={(e) =>
              setChosen(Array.from(e.target.selectedOptions, (x) => x.value))
            }
          >
            {markets.map((market) => (
              <option key={market.marketId} value={market.marketId}>
                {market.canonicalSymbol} · {market.venueId}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From (local → UTC)">
          <input
            type="datetime-local"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To (local → UTC)">
          <input
            type="datetime-local"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <button className="button" disabled={busy}>
          Create dataset
        </button>
      </form>
      <div className="dataset-grid">
        {datasets.map((dataset) => (
          <article key={dataset.id}>
            <div>
              <span
                className={`badge ${datasetReady(dataset) ? 'executable' : ''}`}
              >
                {datasetReady(dataset) ? 'READY' : 'BLOCKED'}
              </span>
              <h3>{dataset.id}</h3>
              <p>{dataset.marketIds.join(' · ')}</p>
              <p>
                {formatDateTime(dataset.from)} → {formatDateTime(dataset.to)} ·{' '}
                {dataset.eventCount} events
              </p>
              <p>
                SHA {dataset.checksum.slice(0, 16)} ·{' '}
                {dataset.qualityReport?.issues.length ?? 'not validated'} issues
              </p>
            </div>
            <div className="row-actions">
              <button
                disabled={busy}
                onClick={() =>
                  void mutate(async () => {
                    await request(`/datasets/${dataset.id}/validate`, {
                      method: 'POST',
                    });
                    await reload();
                  })
                }
              >
                Validate
              </button>
              <button
                disabled={
                  busy ||
                  !dataset.qualityReport?.valid ||
                  Boolean(dataset.pinnedAt)
                }
                onClick={() =>
                  void mutate(async () => {
                    if (!window.confirm('Pin this immutable dataset?')) return;
                    await request(`/datasets/${dataset.id}/pin`, {
                      method: 'POST',
                    });
                    await reload();
                  })
                }
              >
                Pin
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExperimentWorkspace({
  experiments,
  busy,
  onChange,
  mutate,
  onSelect,
}: {
  experiments: Experiment[];
  busy: boolean;
  onChange: (items: Experiment[]) => void;
  mutate: (work: () => Promise<void>) => Promise<void>;
  onSelect: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  return (
    <section className="workspace-panel">
      <h2>Research experiments</h2>
      <form
        className="experiment-create"
        onSubmit={(e) => {
          e.preventDefault();
          void mutate(async () => {
            const created = await request<Experiment>(
              '/backtests/experiments',
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name, hypothesis }),
              },
            );
            onChange([created, ...experiments]);
            setName('');
            setHypothesis('');
            onSelect(created.id);
          });
        }}
      >
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Testable hypothesis">
          <textarea
            required
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
          />
        </Field>
        <button className="button" disabled={busy}>
          Create experiment
        </button>
      </form>
      <div className="experiment-list">
        {experiments.map((experiment) => (
          <button key={experiment.id} onClick={() => onSelect(experiment.id)}>
            <strong>{experiment.name}</strong>
            <span>{experiment.hypothesis}</span>
            <small>{experiment.runCount} runs</small>
          </button>
        ))}
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';

import { formatDateTime } from '../lib/time';

interface Run {
  id: string;
  status: string;
  inputKind: string;
  inputReference: string;
  sourceCommit: string;
  attempt: number;
  createdAt: string;
  strategyVersion: {
    version: string;
    strategy: { id: string; name: string };
  };
  parameterSet: { name: string; fingerprint: string };
}

const actions: Record<string, readonly string[]> = {
  scheduled: ['start', 'cancel'],
  running: ['pause', 'cancel'],
  paused: ['resume', 'cancel'],
  failed: ['retry'],
};

export function StrategyRunsConsole({
  initialRuns,
}: {
  initialRuns: unknown[];
}) {
  const [runs, setRuns] = useState(initialRuns as Run[]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  async function refresh() {
    const response = await fetch('/api/backend/strategy-runs', {
      cache: 'no-store',
    });
    if (!response.ok)
      throw new Error('No fue posible actualizar las ejecuciones');
    setRuns((await response.json()) as Run[]);
  }
  async function control(id: string, action: string) {
    setBusy(id);
    setMessage('');
    try {
      const response = await fetch(
        `/api/backend/strategy-runs/${id}/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: `dashboard_${action}` }),
        },
      );
      if (!response.ok) throw new Error(await response.text());
      await refresh();
      setMessage(`${action} confirmado`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operación fallida');
    } finally {
      setBusy('');
    }
  }
  return (
    <main>
      <section className="page-heading compact-heading">
        <div>
          <span className="overline">VERSIONED STRATEGIES</span>
          <h1>Estrategias</h1>
          <p>Runs, parámetros, procedencia y transiciones auditadas.</p>
        </div>
        <button className="button" onClick={() => void refresh()}>
          Actualizar
        </button>
      </section>
      <p className="live-message" role="status">
        {message}
      </p>
      <section className="workspace-panel table-scroll">
        <table>
          <thead>
            <tr>
              <th>Estrategia</th>
              <th>Estado</th>
              <th>Parámetros</th>
              <th>Input</th>
              <th>Commit</th>
              <th>Intento</th>
              <th>Creado</th>
              <th>Controles</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  {run.strategyVersion.strategy.name} @
                  {run.strategyVersion.version}
                </td>
                <td>{run.status}</td>
                <td title={run.parameterSet.fingerprint}>
                  {run.parameterSet.name}
                </td>
                <td>
                  {run.inputKind}: {run.inputReference}
                </td>
                <td>{run.sourceCommit.slice(0, 12)}</td>
                <td>{run.attempt}</td>
                <td>{formatDateTime(run.createdAt)}</td>
                <td>
                  <div className="panel-actions">
                    {(actions[run.status] ?? []).map((action) => (
                      <button
                        className="button secondary"
                        disabled={busy === run.id}
                        key={action}
                        onClick={() => void control(run.id, action)}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!runs.length ? <p>No hay ejecuciones programadas.</p> : null}
      </section>
    </main>
  );
}

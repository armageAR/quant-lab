'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { formatDateTime } from '../lib/time';
import { ApiIcon, HomeIcon, PulseIcon, RadarIcon, ReplayIcon } from './icons';
import { Modal } from './modal';

const apiGroups: Array<
  [string, Array<{ method: 'GET' | 'POST'; path: string }>]
> = [
  [
    'Sistema',
    ['/health/live', '/health/ready', '/metrics'].map((path) => ({
      method: 'GET',
      path,
    })),
  ],
  [
    'Mercados',
    [
      '/markets/comparable',
      '/markets/trades',
      '/markets/tickers',
      '/markets/candles',
      '/markets/order-book',
    ].map((path) => ({ method: 'GET', path })),
  ],
  [
    'Oportunidades',
    [
      { method: 'GET', path: '/opportunities' },
      { method: 'POST', path: '/opportunities/evaluate' },
      { method: 'GET', path: '/executable-opportunities' },
      { method: 'POST', path: '/executable-opportunities/evaluate' },
      { method: 'GET', path: '/research/report' },
      { method: 'GET', path: '/research/report.csv' },
    ],
  ],
  [
    'Datasets',
    [
      { method: 'POST', path: '/datasets' },
      { method: 'GET', path: '/datasets/:id' },
      { method: 'GET', path: '/datasets/:id/events' },
      { method: 'POST', path: '/datasets/:id/validate' },
      { method: 'POST', path: '/datasets/:id/pin' },
      { method: 'POST', path: '/datasets/:id/export' },
      { method: 'POST', path: '/datasets/:id/compact' },
    ],
  ],
  [
    'Backtests',
    [
      { method: 'GET', path: '/backtests/experiments' },
      { method: 'POST', path: '/backtests/experiments' },
      { method: 'GET', path: '/backtests/runs' },
      { method: 'POST', path: '/backtests/runs' },
      { method: 'GET', path: '/backtests/runs/:id' },
      { method: 'POST', path: '/backtests/runs/:id/pause' },
      { method: 'POST', path: '/backtests/runs/:id/resume' },
      { method: 'POST', path: '/backtests/runs/:id/cancel' },
      { method: 'GET', path: '/backtests/compare' },
      { method: 'POST', path: '/backtests/sweeps' },
      { method: 'GET', path: '/backtests/runs/:id/export.csv' },
    ],
  ],
] as const;

interface StatusResponse {
  checkedAt: string;
  results: Array<{
    latencyMs: number;
    name: string;
    ok: boolean;
    status: number;
    url: string;
  }>;
}

export function TopNav() {
  const pathname = usePathname();
  const [modal, setModal] = useState<'api' | 'health' | null>(null);
  const [status, setStatus] = useState<StatusResponse>();
  const [loading, setLoading] = useState(false);

  async function openHealth() {
    setModal('health');
    setLoading(true);
    try {
      const response = await fetch('/api/system-status', { cache: 'no-store' });
      setStatus(
        response.ok ? ((await response.json()) as StatusResponse) : undefined,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav aria-label="Navegación principal" className="top-nav">
        <a className="brand" href="/" title="Quant Lab">
          <span className="brand-mark">QL</span>
          <span>QUANT LAB</span>
        </a>
        <div className="nav-links">
          <a aria-current={pathname === '/' ? 'page' : undefined} href="/">
            <HomeIcon /> <span>Inicio</span>
          </a>
          <a
            aria-current={pathname === '/opportunities' ? 'page' : undefined}
            href="/opportunities"
          >
            <RadarIcon /> <span>Oportunidades</span>
          </a>
          <a
            aria-current={pathname === '/backtests' ? 'page' : undefined}
            href="/backtests"
          >
            <ReplayIcon /> <span>Backtests</span>
          </a>
        </div>
        <div className="nav-tools">
          <button onClick={() => void openHealth()} type="button">
            <PulseIcon /> <span>Health</span>
          </button>
          <button onClick={() => setModal('api')} type="button">
            <ApiIcon /> <span>API</span>
          </button>
        </div>
      </nav>

      <Modal
        onClose={() => setModal(null)}
        open={modal === 'health'}
        title="Estado de servicios"
      >
        <div className="health-grid">
          {loading ? <p>Consultando servicios…</p> : null}
          {!loading && !status ? (
            <p>No fue posible consultar los servicios.</p>
          ) : null}
          {status?.results.map((check) => (
            <a
              className="health-row"
              href={check.url}
              key={check.name}
              rel="noreferrer"
              target="_blank"
            >
              <span className={`health-dot ${check.ok ? 'ok' : 'down'}`} />
              <span>
                <strong>{check.name}</strong>
                <small>{check.url}</small>
              </span>
              <span>
                {check.ok ? `HTTP ${check.status}` : 'SIN RESPUESTA'} ·{' '}
                {check.latencyMs}ms
              </span>
            </a>
          ))}
        </div>
        {status ? (
          <p className="modal-note">
            Actualizado {formatDateTime(status.checkedAt)} · GMT-3
          </p>
        ) : null}
      </Modal>

      <Modal
        onClose={() => setModal(null)}
        open={modal === 'api'}
        title="Rutas disponibles"
      >
        <p className="modal-note">
          Los enlaces GET se abren contra la API local. Las rutas con{' '}
          <code>:id</code> requieren reemplazar el parámetro.
        </p>
        <div className="endpoint-groups">
          {apiGroups.map(([group, endpoints]) => (
            <section key={group}>
              <h3>{group}</h3>
              {endpoints.map((endpoint) => {
                const parameterized = endpoint.path.includes(':');
                return parameterized || endpoint.method !== 'GET' ? (
                  <code key={`${endpoint.method}-${endpoint.path}`}>
                    {endpoint.method} {endpoint.path}
                  </code>
                ) : (
                  <a
                    href={`http://localhost:3000${endpoint.path}`}
                    key={`${endpoint.method}-${endpoint.path}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    GET {endpoint.path}
                  </a>
                );
              })}
            </section>
          ))}
          <section>
            <h3>Worker</h3>
            {['/health/live', '/health/ready', '/metrics', '/status'].map(
              (endpoint) => (
                <a
                  href={`http://localhost:3002${endpoint}`}
                  key={endpoint}
                  rel="noreferrer"
                  target="_blank"
                >
                  GET {endpoint}
                </a>
              ),
            )}
          </section>
        </div>
      </Modal>
    </>
  );
}

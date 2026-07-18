'use client';

import { useRouter } from 'next/navigation';
import { useDeferredValue, useState, useTransition } from 'react';

import { formatDateTime } from '../lib/time';

export interface OpportunityRow {
  classification: 'executable' | 'missed' | 'observed' | 'rejected';
  detail: string;
  direction: string;
  evaluatedAt: string;
  id: string;
  netProfit?: string;
  source: 'observed' | 'executable';
  spread?: string;
  symbol: string;
}

type SortKey = keyof Pick<
  OpportunityRow,
  | 'classification'
  | 'detail'
  | 'direction'
  | 'evaluatedAt'
  | 'netProfit'
  | 'source'
  | 'spread'
  | 'symbol'
>;

const columns: Array<[SortKey, string]> = [
  ['evaluatedAt', 'Fecha y hora'],
  ['symbol', 'Especie'],
  ['direction', 'Operación'],
  ['source', 'Etapa'],
  ['classification', 'Resultado'],
  ['spread', 'Spread'],
  ['netProfit', 'Neto'],
  ['detail', 'Detalle'],
];

function compare(a: OpportunityRow, b: OpportunityRow, key: SortKey): number {
  if (key === 'evaluatedAt')
    return (
      new Date(a.evaluatedAt).getTime() - new Date(b.evaluatedAt).getTime()
    );
  if (key === 'spread' || key === 'netProfit')
    return Number(a[key] ?? 0) - Number(b[key] ?? 0);
  return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'es');
}

export function OpportunitiesTable({ rows }: { rows: OpportunityRow[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [symbol, setSymbol] = useState('all');
  const [direction, setDirection] = useState('all');
  const [classification, setClassification] = useState('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(
    search.trim().toLocaleLowerCase('es'),
  );
  const [sort, setSort] = useState<{ ascending: boolean; key: SortKey }>({
    key: 'evaluatedAt',
    ascending: false,
  });

  const symbols = [...new Set(rows.map((row) => row.symbol))].sort();
  const directions = [...new Set(rows.map((row) => row.direction))].sort();
  const filtered = rows
    .filter((row) => symbol === 'all' || row.symbol === symbol)
    .filter((row) => direction === 'all' || row.direction === direction)
    .filter(
      (row) =>
        classification === 'all' || row.classification === classification,
    )
    .filter(
      (row) =>
        !deferredSearch ||
        `${row.symbol} ${row.direction} ${row.detail}`
          .toLocaleLowerCase('es')
          .includes(deferredSearch),
    )
    .sort((a, b) => compare(a, b, sort.key) * (sort.ascending ? 1 : -1));

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      ascending: current.key === key ? !current.ascending : true,
    }));
  }

  function resetFilters() {
    setSearch('');
    setSymbol('all');
    setDirection('all');
    setClassification('all');
    setSort({ key: 'evaluatedAt', ascending: false });
  }

  function refresh() {
    startRefresh(() => router.refresh());
  }

  return (
    <section className="data-panel" aria-label="Todas las oportunidades">
      <div className="filter-bar">
        <label>
          Buscar
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Símbolo o detalle"
            type="search"
            value={search}
          />
        </label>
        <label>
          Especie
          <select
            onChange={(event) => setSymbol(event.target.value)}
            value={symbol}
          >
            <option value="all">Todas</option>
            {symbols.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Operación
          <select
            onChange={(event) => setDirection(event.target.value)}
            value={direction}
          >
            <option value="all">Todas</option>
            {directions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Resultado
          <select
            onChange={(event) => setClassification(event.target.value)}
            value={classification}
          >
            <option value="all">Todos</option>
            <option value="executable">Executable</option>
            <option value="missed">Missed</option>
            <option value="observed">Observed</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <div className="filter-actions">
          <span className="result-count">
            {filtered.length} / {rows.length}
          </span>
          <button
            className="button secondary compact-button"
            onClick={resetFilters}
            type="button"
          >
            Restablecer
          </button>
          <button
            className="button compact-button"
            disabled={refreshing}
            onClick={refresh}
            type="button"
          >
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <colgroup>
            <col className="column-date" />
            <col className="column-symbol" />
            <col className="column-direction" />
            <col className="column-source" />
            <col className="column-result" />
            <col className="column-number" />
            <col className="column-number" />
            <col className="column-detail" />
          </colgroup>
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th key={key}>
                  <button
                    aria-label={`Ordenar por ${label}`}
                    onClick={() => toggleSort(key)}
                    type="button"
                  >
                    {label}
                    <span>
                      {sort.key === key ? (sort.ascending ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={`${row.source}-${row.id}`}>
                <td className="date-cell">
                  {formatDateTime(row.evaluatedAt)}
                  <small>GMT-3</small>
                </td>
                <td>
                  <strong>{row.symbol}</strong>
                </td>
                <td>{row.direction}</td>
                <td>
                  <span className="source-label">{row.source}</span>
                </td>
                <td>
                  <span className={`badge ${row.classification}`}>
                    {row.classification}
                  </span>
                </td>
                <td className="numeric">{row.spread ?? '—'}</td>
                <td className="numeric">{row.netProfit ?? '—'}</td>
                <td className="detail-cell" title={row.detail}>
                  {row.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="empty-state">
            No hay oportunidades para los filtros seleccionados.
          </div>
        ) : null}
      </div>
    </section>
  );
}

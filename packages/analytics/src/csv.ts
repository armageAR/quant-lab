import type { ResearchRecord } from './report';

const COLUMNS: readonly (keyof ResearchRecord)[] = [
  'evaluatedAt',
  'canonicalSymbol',
  'direction',
  'classification',
  'topOfBookSpread',
  'grossProfit',
  'feeCost',
  'slippageCost',
  'netProfit',
  'buyFreshnessMs',
  'sellFreshnessMs',
  'crossVenueSkewMs',
];

function escape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Serializes evaluation records to CSV for offline analysis. Column order is
 * stable and missing optional decimals render as empty cells, so the same
 * records always produce byte-identical output.
 */
export function recordsToCsv(records: readonly ResearchRecord[]): string {
  const header = COLUMNS.join(',');
  const rows = records.map((record) =>
    COLUMNS.map((column) => {
      const value = record[column];
      return value === undefined ? '' : escape(String(value));
    }).join(','),
  );
  return [header, ...rows].join('\n');
}

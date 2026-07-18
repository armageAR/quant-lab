import { StrategyRunsConsole } from './strategy-runs-console';

async function runs() {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://localhost:3000'}/strategy-runs`,
      { cache: 'no-store' },
    );
    return response.ok ? ((await response.json()) as unknown[]) : [];
  } catch {
    return [];
  }
}

export default async function StrategiesPage() {
  return <StrategyRunsConsole initialRuns={await runs()} />;
}

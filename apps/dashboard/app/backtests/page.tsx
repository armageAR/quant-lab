import { BacktestConsole } from './backtest-console';
import type { Dataset, Experiment, Market, Run } from './model';

async function read<T>(path: string): Promise<T[]> {
  const api = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';
  try {
    const response = await fetch(`${api}${path}`, { cache: 'no-store' });
    return response.ok ? ((await response.json()) as T[]) : [];
  } catch {
    return [];
  }
}

export default async function BacktestsPage() {
  const [datasets, experiments, runs, markets] = await Promise.all([
    read<Dataset>('/datasets?limit=200'),
    read<Experiment>('/backtests/experiments'),
    read<Run>('/backtests/runs'),
    read<Market>('/markets/comparable'),
  ]);
  return (
    <BacktestConsole
      initialDatasets={datasets}
      initialExperiments={experiments}
      initialRuns={runs}
      markets={markets}
      commitSha={process.env.APP_COMMIT_SHA ?? ''}
    />
  );
}

import { PaperConsole } from './paper-console';

async function sessions() {
  try {
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://localhost:3000'}/paper-trading/sessions`,
      { cache: 'no-store' },
    );
    return response.ok ? ((await response.json()) as unknown[]) : [];
  } catch {
    return [];
  }
}

export default async function PaperTradingPage() {
  return (
    <PaperConsole
      initialSessions={await sessions()}
      commitSha={process.env.APP_COMMIT_SHA ?? ''}
    />
  );
}

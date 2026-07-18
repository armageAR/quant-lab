import { NextResponse } from 'next/server';

const checks = [
  [
    'API live',
    process.env.API_INTERNAL_URL ?? 'http://localhost:3000',
    '/health/live',
  ],
  [
    'API ready',
    process.env.API_INTERNAL_URL ?? 'http://localhost:3000',
    '/health/ready',
  ],
  [
    'Worker live',
    process.env.WORKER_INTERNAL_URL ?? 'http://localhost:3002',
    '/health/live',
  ],
  [
    'Worker ready',
    process.env.WORKER_INTERNAL_URL ?? 'http://localhost:3002',
    '/health/ready',
  ],
] as const;

export async function GET() {
  const results = await Promise.all(
    checks.map(async ([name, base, path]) => {
      const started = Date.now();
      try {
        const response = await fetch(`${base}${path}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(3000),
        });
        return {
          name,
          url: `${base}${path}`,
          ok: response.ok,
          status: response.status,
          latencyMs: Date.now() - started,
        };
      } catch {
        return {
          name,
          url: `${base}${path}`,
          ok: false,
          status: 0,
          latencyMs: Date.now() - started,
        };
      }
    }),
  );
  return NextResponse.json({ checkedAt: new Date().toISOString(), results });
}

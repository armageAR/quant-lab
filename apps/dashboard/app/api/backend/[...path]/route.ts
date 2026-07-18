import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ALLOWED_ROOTS = new Set([
  'backtests',
  'datasets',
  'markets',
  'paper-trading',
  'strategy-runs',
]);

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!path[0] || !ALLOWED_ROOTS.has(path[0]))
    return NextResponse.json(
      { message: 'backend route is not allowed' },
      { status: 404 },
    );
  const target = new URL(
    `/${path.join('/')}`,
    process.env.API_INTERNAL_URL ?? 'http://localhost:3000',
  );
  target.search = request.nextUrl.search;
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: {
        'content-type':
          request.headers.get('content-type') ?? 'application/json',
      },
      ...(request.method === 'GET' ? {} : { body: await request.text() }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
        ...(upstream.headers.get('content-disposition')
          ? {
              'content-disposition': upstream.headers.get(
                'content-disposition',
              )!,
            }
          : {}),
        ...(upstream.headers.get('x-correlation-id')
          ? { 'x-correlation-id': upstream.headers.get('x-correlation-id')! }
          : {}),
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'API unavailable or timed out' },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;

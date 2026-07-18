import type { DatabaseLifecycle } from '@quant-lab/database';
import type { ApplicationMetrics } from '@quant-lab/shared';
import { createServer, type Server, type ServerResponse } from 'node:http';

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

export async function startHealthServer(
  port: number,
  database: DatabaseLifecycle,
  metrics: ApplicationMetrics,
  status?: () => unknown,
): Promise<Server> {
  const server = createServer(async (request, response) => {
    if (request.url === '/health/live') {
      json(response, 200, { status: 'ok', time: new Date().toISOString() });
      return;
    }

    if (request.url === '/health/ready') {
      const ready = await database.probe();
      metrics.databaseReady.set(ready ? 1 : 0);
      json(response, ready ? 200 : 503, {
        status: ready ? 'ok' : 'unavailable',
        time: new Date().toISOString(),
      });
      return;
    }

    if (request.url === '/metrics') {
      response.writeHead(200, { 'content-type': metrics.registry.contentType });
      response.end(await metrics.registry.metrics());
      return;
    }

    if (request.url === '/status') {
      json(response, 200, status?.() ?? { enabled: false, state: 'stopped' });
      return;
    }

    json(response, 404, { status: 'not_found' });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

export async function closeHealthServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

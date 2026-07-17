import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export interface ApplicationMetrics {
  databaseReady: Gauge;
  gracefulShutdowns: Counter;
  httpDuration: Histogram;
  httpRequests: Counter;
  registry: Registry;
  workerReady: Gauge;
}

export function createApplicationMetrics(app: string): ApplicationMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ app });
  collectDefaultMetrics({ register: registry, prefix: 'quant_lab_' });

  return {
    registry,
    databaseReady: new Gauge({
      name: 'quant_lab_database_ready',
      help: 'Whether the application database probe succeeds.',
      registers: [registry],
    }),
    workerReady: new Gauge({
      name: 'quant_lab_worker_ready',
      help: 'Whether the worker is ready to accept operations.',
      registers: [registry],
    }),
    gracefulShutdowns: new Counter({
      name: 'quant_lab_graceful_shutdown_total',
      help: 'Number of graceful shutdowns.',
      registers: [registry],
    }),
    httpRequests: new Counter({
      name: 'quant_lab_http_requests_total',
      help: 'Number of HTTP requests.',
      labelNames: ['method', 'route', 'status'] as const,
      registers: [registry],
    }),
    httpDuration: new Histogram({
      name: 'quant_lab_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status'] as const,
      registers: [registry],
    }),
  };
}

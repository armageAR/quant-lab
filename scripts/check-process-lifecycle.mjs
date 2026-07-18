import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();

function start(app, environment) {
  const child = spawn('node', ['dist/main.js'], {
    cwd: `${root}/apps/${app}`,
    env: {
      ...process.env,
      LIVE_EXECUTION_ENABLED: 'false',
      LOG_FORMAT: 'json',
      LOG_LEVEL: 'info',
      NODE_ENV: 'test',
      ...environment,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += String(chunk)));
  child.stderr.on('data', (chunk) => (output += String(chunk)));
  return { child, output: () => output };
}

async function waitFor(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // The process may still be starting.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stop(process) {
  const exited = new Promise((resolve) => process.once('exit', resolve));
  process.kill('SIGTERM');
  const code = await Promise.race([exited, delay(5_000).then(() => 'timeout')]);
  if (code === 'timeout') {
    process.kill('SIGKILL');
    throw new Error('Process did not stop within five seconds');
  }
  if (code !== 0) throw new Error(`Process exited with code ${String(code)}`);
}

const api = start('api', { PORT: '43100' });
const worker = start('worker', {
  EXCHANGE_CONNECTIVITY_ENABLED: 'false',
  EXECUTABLE_DETECTOR_ENABLED: 'false',
  OBSERVATION_LOOP_ENABLED: 'false',
  WORKER_HEALTH_PORT: '43102',
});

try {
  const apiReady = await waitFor('http://127.0.0.1:43100/health/ready');
  if (apiReady.headers.get('x-correlation-id') === null) {
    throw new Error('API response did not include a correlation ID');
  }
  await waitFor('http://127.0.0.1:43100/metrics');
  await waitFor('http://127.0.0.1:43102/health/ready');
  await waitFor('http://127.0.0.1:43102/metrics');
  await Promise.all([stop(api.child), stop(worker.child)]);
} catch (error) {
  api.child.kill('SIGKILL');
  worker.child.kill('SIGKILL');
  throw new Error(
    `${String(error)}\nAPI output:\n${api.output()}\nWorker output:\n${worker.output()}`,
  );
}

const failed = start('api', {
  DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/invalid',
  PORT: '43101',
});
const failedCode = await new Promise((resolve) =>
  failed.child.once('exit', resolve),
);
if (failedCode === 0) {
  throw new Error(
    'API startup unexpectedly succeeded with unavailable PostgreSQL',
  );
}

process.stdout.write('API and worker lifecycle checks passed.\n');

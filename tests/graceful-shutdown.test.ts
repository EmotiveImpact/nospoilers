import {EventEmitter} from 'node:events';
import {spawn, type ChildProcess} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {expect, it, vi} from 'vitest';
import {closeRuntimeResources,installGracefulShutdown} from '../src/server/shutdown.ts';
import {openSql} from '../src/server/sql.ts';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {resolve = done;});
  return {promise, resolve};
}

it('drains HTTP before closing the runtime and handles repeated termination signals only once', async () => {
  const signals = new EventEmitter();
  const http = deferred();
  const runtime = deferred();
  const closeHttp = vi.fn(() => http.promise);
  const closeRuntime = vi.fn(() => runtime.promise);
  const onError = vi.fn();
  const shutdown = installGracefulShutdown({signals, closeHttp, closeRuntime, onError});
  signals.emit('SIGTERM');
  signals.emit('SIGINT');
  signals.emit('SIGTERM');
  expect(closeHttp).toHaveBeenCalledTimes(1);
  expect(closeRuntime).not.toHaveBeenCalled();
  const completion = shutdown();
  expect(shutdown()).toBe(completion);
  http.resolve();
  await Promise.resolve();
  expect(closeRuntime).toHaveBeenCalledTimes(1);
  let complete = false;
  void completion.then(() => {complete = true;});
  await Promise.resolve();
  expect(complete).toBe(false);
  runtime.resolve();
  await completion;
  expect(onError).not.toHaveBeenCalled();
  expect(signals.listenerCount('SIGTERM')).toBe(0);
  expect(signals.listenerCount('SIGINT')).toBe(0);
  await shutdown();
  expect(closeHttp).toHaveBeenCalledTimes(1);
  expect(closeRuntime).toHaveBeenCalledTimes(1);
});

it('still closes the runtime when HTTP draining fails and reports the failure', async () => {
  const failure = new Error('HTTP close failed');
  const closeRuntime = vi.fn(async () => undefined);
  const onError = vi.fn();
  const signals = new EventEmitter();
  await installGracefulShutdown({signals, closeHttp: async () => {throw failure;}, closeRuntime, onError})();
  expect(closeRuntime).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(failure);
  expect(signals.listenerCount('SIGTERM')).toBe(0);
});

it('reports runtime close failures and removes both handlers', async () => {
  const failure = new Error('Database close failed');
  const signals = new EventEmitter();
  const onError = vi.fn();
  await installGracefulShutdown({signals, closeHttp: async () => undefined, closeRuntime: async () => {throw failure;}, onError})();
  expect(onError).toHaveBeenCalledWith(failure);
  expect(signals.listenerCount('SIGTERM')).toBe(0);
  expect(signals.listenerCount('SIGINT')).toBe(0);
});

it('attempts every runtime cleanup in order and propagates cleanup rejections', async () => {
  const order:string[]=[];
  const pollerFailure=new Error('poller stop failed');
  const listenerFailure=new Error('listener stop failed');
  const closing=closeRuntimeResources([
    async()=>{order.push('poller');throw pollerFailure;},
    async()=>{order.push('listener');throw listenerFailure;},
    async()=>{order.push('worker');},
    async()=>{order.push('sql');},
  ]);
  await expect(closing).rejects.toMatchObject({
    message:'Multiple runtime resources failed to close.',
    errors:[pollerFailure,listenerFailure],
  });
  expect(order).toEqual(['poller','listener','worker','sql']);
});

it('shuts the actual worker entrypoint down on SIGTERM and leaves its isolated disk database reopenable', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nospoilers-shutdown-test-'));
  const databaseUrl = `pglite://${path.join(root, 'database')}`;
  let child: ChildProcess | undefined;
  try {
    const seed = await openSql(databaseUrl);
    try {
      await seed.exec("CREATE TABLE shutdown_marker(value text); INSERT INTO shutdown_marker VALUES ('preserved')");
    } finally {await seed.close();}
    // The worker's startup log is emitted before signal handlers are installed.
    // Wait until the actual entrypoint finishes evaluating, not until stdout is
    // flushed, so SIGTERM always exercises graceful shutdown rather than racing
    // Node's default pre-startup signal behavior.
    const entrypoint = pathToFileURL(path.resolve('src/server/index.ts')).href;
    const start = `await import(${JSON.stringify(entrypoint)}); process.send('ready', () => process.disconnect());`;
    child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '--eval', start], {
      cwd: root,
      env: {
        PATH: process.env.PATH, TMPDIR: tmpdir(), NODE_ENV: 'test',
        DATABASE_URL: databaseUrl, APP_BASE_URL: 'http://127.0.0.1:4347',
        SESSION_SECRET: 'isolated-shutdown-test-session-secret',
        RECEIPT_SECRET: 'isolated-shutdown-test-receipt-secret',
        NOSPOILERS_ROLE: 'worker', WORKER_INTERVAL_MS: '3600000', POLL_INTERVAL_MS: '3600000',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const spawned = child;
    const exited = new Promise<{code: number | null; signal: NodeJS.Signals | null}>((resolve, reject) => {
      spawned.once('error', reject);
      spawned.once('exit', (code, signal) => resolve({code, signal}));
    });
    spawned.stderr!.resume();
    spawned.stdout!.resume();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Isolated worker did not reach ready state')), 20_000);
      spawned.on('message', message => {
        if (message === 'ready') {clearTimeout(timeout); resolve();}
      });
      void exited.then(result => {clearTimeout(timeout); reject(new Error(`Isolated worker exited before ready: code=${result.code}, signal=${result.signal}`));}, error => {clearTimeout(timeout); reject(error);});
    });
    expect(spawned.kill('SIGTERM')).toBe(true);
    expect(await exited).toEqual({code: 0, signal: null});
    const reopened = await openSql(databaseUrl);
    try {
      expect((await reopened.query('SELECT value FROM shutdown_marker')).rows).toEqual([{value: 'preserved'}]);
      expect((await reopened.query('SELECT count(*)::int AS count FROM schema_migrations')).rows).toEqual([{count: expect.any(Number)}]);
    } finally {await reopened.close();}
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await new Promise<void>(resolve => child!.once('exit', () => resolve()));
    }
    await rm(root, {recursive: true, force: true});
  }
});

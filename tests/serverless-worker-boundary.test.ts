import {expect, it} from 'vitest';
import {createRuntime} from '../src/server/runtime.ts';
import {createVercelHandler} from '../src/server/vercel.ts';

it('leaves heavy queued jobs for the persistent worker after a Vercel web response', async () => {
  const runtime = await createRuntime({
    databaseUrl: 'pglite://:memory:',
    appBaseUrl: 'http://127.0.0.1:4347',
    githubAppId: '', githubPrivateKey: '', githubWebhookSecret: '',
    githubClientId: '', githubClientSecret: '',
    sessionSecret: 'serverless-worker-boundary-test-session-secret',
    processRole: 'web',
  });
  try {
    // An intentionally incomplete internal job detects admission/claims without
    // parsing an archive or making a GitHub request if the boundary regresses.
    await runtime.store.enqueueJob({
      priority: 'heavy', kind: 'member_added', payload: {login: 'boundary-fixture'},
    });
    const pending: Promise<unknown>[] = [];
    const response = await createVercelHandler(async () => runtime)(
      new Request('http://127.0.0.1:4347/api/health'),
      {waitUntil: work => {pending.push(work);}},
    );
    expect(response.status).toBe(200);
    await Promise.all(pending);
    const {rows} = await runtime.sql.query<{status: string; attempts: number}>(
      'SELECT status, attempts FROM jobs',
    );
    expect(rows).toEqual([{status: 'queued', attempts: 0}]);
  } finally {
    await runtime.close();
  }
});

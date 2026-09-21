import {expect, it, vi} from 'vitest';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {skippedGithubWrites, type GithubPort} from '../src/server/github.ts';
import {migrate, openSql} from '../src/server/sql.ts';
import {createStore} from '../src/server/store.ts';

it('creates a scoped personal workspace after verified OAuth and preserves its original trial on repeat login', async () => {
  const sql = await openSql('pglite://:memory:');
  try {
    await migrate(sql);
    const unexpected = async (): Promise<never> => {throw new Error('Unexpected provider operation');};
    const exchangeCode = vi.fn(async () => 'fixture-oauth-access-token');
    const github: GithubPort = {
      exchangeCode, getUser: async () => ({id: 9001, login: 'signup-fixture', avatar_url: ''}),
      listUserInstallations: async () => [], getInstallation: unexpected,
      getRepo: unexpected, listReleaseAssets: unexpected, getLatestRelease: unexpected,
      downloadAsset: unexpected, ...skippedGithubWrites(),
    };
    const app = createApp({store: createStore(sql), github, config: loadConfig({
      databaseUrl: 'pglite://:memory:', appBaseUrl: 'https://app.example.test',
      sessionSecret: 'signup-workspace-boundary-test-session-secret',
      githubAppId: 'test-app', githubPrivateKey: 'test-private-key',
      githubWebhookSecret: 'test-webhook-secret', githubClientId: 'test-client',
      githubClientSecret: 'test-client-secret',
    })});
    async function begin() {
      const response = await app.request('https://app.example.test/api/auth/github');
      expect(response.status).toBe(302);
      const location = new URL(response.headers.get('location')!);
      expect(location.searchParams.get('redirect_uri')).toBe('https://app.example.test/api/auth/github/callback');
      return {state: location.searchParams.get('state')!, cookie: response.headers.get('set-cookie')!.split(';')[0]};
    }
    const first = await begin();
    expect((await app.request(`https://app.example.test/api/auth/github/callback?code=fixture&state=wrong`, {headers: {cookie: first.cookie}})).status).toBe(400);
    expect(exchangeCode).not.toHaveBeenCalled();
    async function finish(input: Awaited<ReturnType<typeof begin>>) {
      const response = await app.request(`https://app.example.test/api/auth/github/callback?code=fixture&state=${input.state}`, {headers: {cookie: input.cookie}});
      expect(response.status).toBe(302);
      const sessionHeader = response.headers.getSetCookie().find(value => value.startsWith('ns_session='))!;
      expect(sessionHeader).toContain('HttpOnly');
      expect(sessionHeader).toContain('Secure');
      const listing = await app.request('https://app.example.test/api/workspaces', {headers: {cookie: sessionHeader.split(';')[0]}});
      expect(listing.status).toBe(200);
      return await listing.json() as {workspaces: Array<{id: string; role: string; installation_id: number | null}>};
    }
    const signedIn = await finish(first);
    expect(signedIn.workspaces).toHaveLength(1);
    expect(signedIn.workspaces[0]).toMatchObject({role: 'owner', installation_id: null});
    expect((await sql.query<{issuer:string;subject:string;user_id:string}>(
      "SELECT issuer,subject,user_id FROM product_auth_identities WHERE user_id='9001'",
    )).rows).toEqual([{issuer:'https://github.com',subject:'9001',user_id:'9001'}]);
    expect((await sql.query<{github_account_id:string|number;user_id:string;login:string}>(
      "SELECT github_account_id,user_id,login FROM github_connector_accounts WHERE user_id='9001'",
    )).rows.map(row=>({...row,github_account_id:Number(row.github_account_id)}))).toEqual([
      {github_account_id:9001,user_id:'9001',login:'signup-fixture'},
    ]);
    const trial = (await sql.query<{trial_ends_at: Date | string | null}>("SELECT trial_ends_at FROM users WHERE id='9001'")).rows[0];
    expect(trial.trial_ends_at).toBeTruthy();
    expect((await finish(await begin())).workspaces.map(workspace => workspace.id)).toEqual(signedIn.workspaces.map(workspace => workspace.id));
    expect((await sql.query("SELECT trial_ends_at FROM users WHERE id='9001'")).rows[0]).toEqual(trial);
  } finally {
    await sql.close();
  }
});

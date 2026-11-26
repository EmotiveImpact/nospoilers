import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig, polarConfigured } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql, type SqlClient } from "../src/server/sql.ts";
import { createStore, signSession, type Store } from "../src/server/store.ts";
import {listUserWorkspaces,ensureUserWorkspaces,createWorkspace} from '../src/server/workspaces.ts';
import {inviteWorkspaceMember,acceptWorkspaceInvite} from '../src/server/workspace-membership.ts';
import {
  BILLING_SUBSCRIBE_FIRST_ERROR,
  POLAR_NOT_LIVE_ERROR,
  createPolarPort,
  parsePolarEvent,
  polarSubscriptionPatch,
  polarWebhookHeaders,
  remainingTrialDays,
  verifyPolarWebhook,
  type PolarCheckoutInput,
  type PolarPort,
  type PolarPortalInput,
} from "../src/server/polar.ts";

const SECRET = `whsec_${Buffer.from("nospoilers-polar-standard-webhook-key").toString("base64")}`;
const PRODUCTS = {
  soloMonthly: "11111111-1111-4111-8111-111111111111",
  soloYearly: "22222222-2222-4222-8222-222222222222",
  teamMonthly: "33333333-3333-4333-8333-333333333333",
  teamYearly: "44444444-4444-4444-8444-444444444444",
};

function mockGithub(): GithubPort {
  const fail = async (): Promise<never> => {
    throw new Error("GitHub mock: unexpected call");
  };
  return {
    exchangeCode: fail,
    getUser: fail,
    listUserInstallations: fail,
    getInstallation: fail,
    getRepo: fail,
    listReleaseAssets: fail,
    getLatestRelease: fail,
    downloadAsset: fail,
    ...skippedGithubWrites(),
  };
}

function mockPolar(overrides: Partial<PolarPort> = {}): PolarPort {
  return {
    createCheckout: async () => ({
      id: "chk_1",
      url: "https://polar.sh/checkout/polar_c_test",
    }),
    createPortalSession: async () => ({
      url: "https://polar.sh/nospoilers/portal?customer_session_token=test",
    }),
    ...overrides,
  };
}

const polarConfig = {
  databaseUrl: "pglite://:memory:",
  githubWebhookSecret: "wh",
  githubAppId: "1",
  githubPrivateKey: "x",
  githubClientId: "c",
  githubClientSecret: "s",
  sessionSecret: "sess",
  polarAccessToken: "polar_oat_test",
  polarWebhookSecret: SECRET,
  polarProductSoloMonthly: PRODUCTS.soloMonthly,
  polarProductSoloYearly: PRODUCTS.soloYearly,
  polarProductTeamMonthly: PRODUCTS.teamMonthly,
  polarProductTeamYearly: PRODUCTS.teamYearly,
};

function appFor(store: Store, polar: PolarPort | undefined = mockPolar()) {
  return createApp({
    config: loadConfig(polar ? polarConfig : { ...polarConfig, polarAccessToken: "" }),
    store,
    github: mockGithub(),
    polar,
  });
}

async function seedInstall(
  store: Store,
  opts: { member?: boolean; unpaid?: boolean } = {},
): Promise<{ admin: string; member?: string }> {
  await store.upsertUser({ id: "u1", login: "octo" });
  await store.upsertInstallation({
    id: 7,
    accountLogin: "octo",
    accountType: "User",
    accountId: 1,
  });
  await store.linkUserInstallation(7, "u1");
  const admin = `ns_session=${signSession("sess", await store.createSession("u1"))}`;
  if (opts.member) {
    await store.upsertUser({ id: "u2", login: "teammate" });
    await store.linkUserInstallation(7, "u2");
  }
  if (opts.unpaid) {
    await store.sql.query(
      `UPDATE billing_accounts SET trial_ends_at = '2000-01-01T00:00:00Z', plan = NULL WHERE installation_id = 7`,
    );
  }
  return {
    admin,
    member: opts.member
      ? `ns_session=${signSession("sess", await store.createSession("u2"))}`
      : undefined,
  };
}

async function withStore(run: (ctx: { sql: SqlClient; store: Store }) => Promise<void>): Promise<void> {
  const sql = await openSql("pglite://:memory:");
  try {
    await migrate(sql);
    await run({ sql, store: createStore(sql) });
  } finally {
    await sql.close();
  }
}

let clock = Date.parse("2026-11-26T10:00:00.000Z");
/** A Polar subscription as webhook payloads carry it. Each call is a newer version unless `modified_at` is given. */
function subscription(fields: Record<string, unknown>) {
  clock += 1000;
  return {
    id: "sub_1",
    customer_id: "cus_1",
    status: "active",
    product_id: PRODUCTS.soloMonthly,
    current_period_end: "2026-12-26T10:00:00.000000Z",
    cancel_at_period_end: false,
    created_at: "2026-11-26T09:00:00.000000Z",
    modified_at: new Date(clock).toISOString(),
    metadata: {},
    ...fields,
  };
}

function delivery(id: string, type: string, data: Record<string, unknown>) {
  const body = JSON.stringify({ type, timestamp: new Date().toISOString(), data });
  return { body, headers: polarWebhookHeaders(SECRET, id, body) };
}

function deliver(app: ReturnType<typeof appFor>, id: string, type: string, data: Record<string, unknown>) {
  const { body, headers } = delivery(id, type, data);
  return app.request("/api/webhooks/polar", { method: "POST", headers, body });
}

describe("Polar checkout and lifecycle", () => {
  it('returns checkout and portal to authorised organisation billing without accepting another workspace or redirect',async()=>{
    await withStore(async({sql,store})=>{
      await store.upsertUser({id:'return-owner',login:'return-owner'});
      await store.upsertUser({id:'return-other',login:'return-other'});
      await ensureUserWorkspaces(sql,'return-owner');await ensureUserWorkspaces(sql,'return-other');
      const workspace=(await listUserWorkspaces(sql,'return-owner'))[0];
      const other=(await listUserWorkspaces(sql,'return-other'))[0];
      const cookie=`ns_session=${signSession('sess',await store.createSession('return-owner'))}`;
      const checkouts:PolarCheckoutInput[]=[];
      const portals:PolarPortalInput[]=[];
      const app=appFor(store,mockPolar({createCheckout:async input=>{checkouts.push(input);return {id:'chk_return',url:'https://polar.sh/checkout/return'};},createPortalSession:async input=>{portals.push(input);return {url:'https://polar.sh/nospoilers/portal'};}}));
      const post=(route:string,body:unknown)=>app.request(`/api/billing/${route}`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)});
      const input={organizationId:workspace.organization_id,workspaceId:workspace.id,plan:'solo',interval:'month',returnUrl:'https://attacker.example/'};
      for(const workspaceId of [other.id,'not-a-workspace',null])expect((await post('checkout',{...input,workspaceId})).status).toBe(403);
      expect(checkouts).toHaveLength(0);
      await sql.query("INSERT INTO product_workspace_members(workspace_id,user_id,role,access_source) VALUES($1,'return-owner','viewer','explicit')",[other.id]);
      expect((await post('checkout',{...input,workspaceId:other.id})).status).toBe(403);
      expect(checkouts).toHaveLength(0);
      expect((await post('checkout',input)).status).toBe(200);
      const assertReturn=(value:string,result:string,withWorkspace=true)=>{
        const url=new URL(value);expect(url.origin).toBe(new URL(loadConfig(polarConfig).appBaseUrl).origin);
        expect(url.pathname).toBe('/watch/workspaces');
        expect(Object.fromEntries(url.searchParams)).toEqual({workspaceTab:'billing',billingOrganization:workspace.organization_id,...(withWorkspace?{workspace:workspace.id}:{}),billing:result});
      };
      assertReturn(checkouts[0].successUrl,'ok');assertReturn(checkouts[0].returnUrl,'canceled');
      await sql.query("UPDATE personal_organization_billing SET polar_customer_id='cus_return',polar_subscription_id='sub_return',polar_status='active' WHERE organization_id=$1",[workspace.organization_id]);
      const publicState=await (await app.request(`/api/billing?organizationId=${workspace.organization_id}`,{headers:{cookie}})).json() as {billing:{subscribed:boolean}};
      expect(publicState.billing.subscribed).toBe(false);
      expect((await post('portal',{...input,workspaceId:other.id})).status).toBe(403);expect(portals).toHaveLength(0);
      expect((await post('portal',input)).status).toBe(200);assertReturn(portals[0].returnUrl,'returned');
      expect((await post('checkout',input)).status).toBe(200);assertReturn(portals[1].returnUrl,'returned');expect(checkouts).toHaveLength(1);
      // Organisation ownership remains sufficient to manage billing without workspace access.
      await sql.query("UPDATE product_workspace_members SET access_source='explicit' WHERE user_id='return-owner'");
      await sql.query("INSERT INTO product_workspace_revocations(workspace_id,user_id) SELECT workspace_id,user_id FROM product_workspace_members WHERE user_id='return-owner'");
      await sql.query("DELETE FROM product_workspace_members WHERE user_id='return-owner'");
      expect((await post('portal',{organizationId:workspace.organization_id})).status).toBe(200);assertReturn(portals[2].returnUrl,'returned',false);
      expect((await post('portal',input)).status).toBe(403);
    });
  });

  it('rolls back a webhook claim when entitlement persistence fails so the same delivery can retry',async()=>{
    await withStore(async({sql,store})=>{
      await store.upsertUser({id:'retry-personal',login:'retry-personal'});
      await ensureUserWorkspaces(sql,'retry-personal');
      const workspace=(await listUserWorkspaces(sql,'retry-personal'))[0];
      const cookie=`ns_session=${signSession('sess',await store.createSession('retry-personal'))}`;
      const app=appFor(store);
      await app.request(`/api/billing?organizationId=${workspace.organization_id}`,{headers:{cookie}});
      await sql.exec(`CREATE FUNCTION test_fail_personal_entitlement() RETURNS trigger AS $$ BEGIN
        IF NEW.id='retry-personal' AND NEW.plan='team' THEN RAISE EXCEPTION 'Test persistence failure'; END IF;
        RETURN NEW; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER test_personal_entitlement BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION test_fail_personal_entitlement();`);
      const event=delivery('msg_personal_retry','subscription.updated',subscription({id:'sub_retry',customer_id:'cus_retry',product_id:PRODUCTS.teamMonthly,metadata:{organizationId:workspace.organization_id}}));
      const send=()=>app.request('/api/webhooks/polar',{method:'POST',headers:event.headers,body:event.body});
      expect((await send()).status).toBe(500);
      expect((await sql.query("SELECT id FROM polar_webhook_events WHERE id='msg_personal_retry'")).rows).toHaveLength(0);
      expect((await sql.query('SELECT polar_customer_id FROM personal_organization_billing WHERE organization_id=$1',[workspace.organization_id])).rows[0]).toEqual({polar_customer_id:null});
      await sql.exec('DROP TRIGGER test_personal_entitlement ON users; DROP FUNCTION test_fail_personal_entitlement();');
      const retried=await send();expect(retried.status).toBe(200);
      expect(await retried.json()).toMatchObject({applied:true});
      expect((await sql.query("SELECT plan FROM users WHERE id='retry-personal'")).rows[0]).toEqual({plan:'team'});
      expect((await sql.query("SELECT id FROM polar_webhook_events WHERE id='msg_personal_retry'")).rows).toHaveLength(1);
    });
  });

  it('supports personal organisation checkout, signed shared entitlements and portal without GitHub',async()=>{
    await withStore(async({sql,store})=>{
      await store.upsertUser({id:'personal',login:'personal'});await store.upsertUser({id:'stranger',login:'stranger'});
      await ensureUserWorkspaces(sql,'personal');
      const workspace=(await listUserWorkspaces(sql,'personal'))[0];
      await createWorkspace(sql,'personal',workspace.organization_id,'Second');
      const cookie=`ns_session=${signSession('sess',await store.createSession('personal'))}`;
      const other=`ns_session=${signSession('sess',await store.createSession('stranger'))}`;
      let checkout:PolarCheckoutInput|undefined;
      let portal:PolarPortalInput|undefined;
      const app=appFor(store,mockPolar({createCheckout:async input=>{checkout=input;return {id:'chk_personal',url:'https://polar.sh/checkout/personal'};},createPortalSession:async input=>{portal=input;return {url:'https://polar.sh/nospoilers/portal'};}}));
      const url=`/api/billing?organizationId=${workspace.organization_id}`;
      expect((await app.request(url)).status).toBe(401);
      expect((await app.request(url,{headers:{cookie:other}})).status).toBe(403);
      const state=await (await app.request(url,{headers:{cookie}})).json() as {polar:boolean;billing:{hasCustomer:boolean;trialEndsAt:string|null}};
      expect(state.polar).toBe(true);
      expect(state.billing.hasCustomer).toBe(false);
      const body=JSON.stringify({organizationId:workspace.organization_id,plan:'team',interval:'month'});
      expect((await app.request('/api/billing/checkout',{method:'POST',headers:{cookie:other,'content-type':'application/json'},body})).status).toBe(403);
      expect((await app.request('/api/billing/checkout',{method:'POST',headers:{cookie,'content-type':'application/json'},body})).status).toBe(200);
      expect(checkout?.productId).toBe(PRODUCTS.teamMonthly);
      expect(checkout?.trialDays).toBeGreaterThan(0);
      expect(checkout?.customerId).toBeNull();
      expect(checkout?.metadata).toEqual({organizationId:workspace.organization_id,plan:'team',interval:'month'});
      const data=subscription({id:'sub_personal',customer_id:'cus_personal',status:'trialing',product_id:PRODUCTS.teamMonthly,metadata:checkout?.metadata});
      expect(await (await deliver(app,'msg_personal_created','subscription.created',data)).json()).toMatchObject({applied:true});
      expect(await (await deliver(app,'msg_personal_created','subscription.created',data)).json()).toMatchObject({duplicate:true});
      const after=await (await app.request(url,{headers:{cookie}})).json() as {billing:unknown};
      expect(after.billing).toMatchObject({plan:'team',hasCustomer:true,subscribed:true,status:'trialing',trialEndsAt:state.billing.trialEndsAt});
      expect((await listUserWorkspaces(sql,'personal')).every(w=>w.plan==='team')).toBe(true);
      expect((await app.request('/api/billing/portal',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({organizationId:workspace.organization_id})})).status).toBe(200);
      expect(portal?.customerId).toBe('cus_personal');
      expect((await sql.query('SELECT count(*) AS count FROM installations')).rows[0]).toEqual({count:0});
    });
  });

  it("applies migration 125_polar_billing and keeps the dormant Stripe history", async () => {
    await withStore(async ({ sql }) => {
      const { rows } = await sql.query<{ id: string }>(
        `SELECT id FROM schema_migrations WHERE id IN ('059_stripe_billing','125_polar_billing') ORDER BY id`,
      );
      expect(rows.map((row) => row.id)).toEqual(["059_stripe_billing", "125_polar_billing"]);
      const columns = await sql.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name FROM information_schema.columns
          WHERE column_name LIKE 'polar_%' ORDER BY table_name, column_name`,
      );
      expect(columns.rows.filter((row) => row.table_name === "billing_accounts")).toHaveLength(7);
      expect(columns.rows.filter((row) => row.table_name === "personal_organization_billing")).toHaveLength(7);
    });
  });

  it("verifies Standard Webhooks and earlier Polar signatures and rejects stale or wrong ones", () => {
    const body = `{"type":"subscription.updated"}`;
    const now = 1_790_000_000_000;
    const seconds = Math.floor(now / 1000);
    const headers = (h: Record<string, string>) => ({ id: h["webhook-id"], timestamp: h["webhook-timestamp"], signature: h["webhook-signature"] });
    const standard = headers(polarWebhookHeaders(SECRET, "msg_1", body, seconds));
    expect(verifyPolarWebhook(SECRET, body, standard, now)).toBe(true);
    const legacySecret = "whsec_issued_before_september_2026";
    const legacy = headers(polarWebhookHeaders(legacySecret, "msg_2", body, seconds, "legacy"));
    expect(verifyPolarWebhook(legacySecret, body, legacy, now)).toBe(true);
    // Several signatures may be offered during secret rotation; any valid one is enough.
    expect(verifyPolarWebhook(SECRET, body, { ...standard, signature: `v1,bm9wZQ== ${standard.signature}` }, now)).toBe(true);
    expect(verifyPolarWebhook(`whsec_${Buffer.from("another-key").toString("base64")}`, body, standard, now)).toBe(false);
    expect(verifyPolarWebhook(SECRET, "{}", standard, now)).toBe(false);
    expect(verifyPolarWebhook(SECRET, body, { ...standard, id: "msg_other" }, now)).toBe(false);
    expect(verifyPolarWebhook(SECRET, body, standard, now + 6 * 60 * 1000)).toBe(false);
    expect(verifyPolarWebhook(SECRET, body, { ...standard, signature: undefined }, now)).toBe(false);
    expect(verifyPolarWebhook("", body, standard, now)).toBe(false);
  });

  it("maps remaining trial days and subscription patches from the subscription's own status", () => {
    expect(remainingTrialDays(new Date(Date.now() + 11 * 86_400_000).toISOString())).toBe(11);
    expect(remainingTrialDays("2000-01-01T00:00:00.000Z")).toBe(0);
    const patch = (type: string, data: Record<string, unknown>) => polarSubscriptionPatch(parsePolarEvent({ type, data }, "msg")!, PRODUCTS);
    expect(patch("subscription.past_due", subscription({ status: "past_due", metadata: { installationId: "7" } })))
      .toMatchObject({ clearPlan: true, plan: null, customerId: "cus_1", installationId: 7 });
    // Cancelling at period end keeps the paid period.
    expect(patch("subscription.canceled", subscription({ status: "active", cancel_at_period_end: true })))
      .toMatchObject({ clearPlan: false, plan: "solo" });
    expect(patch("subscription.revoked", subscription({ status: "canceled" }))).toMatchObject({ clearPlan: true, plan: null });
    // A portal plan change moves the product on the same subscription.
    expect(patch("subscription.updated", subscription({ product_id: PRODUCTS.teamYearly, metadata: { plan: "solo" } })))
      .toMatchObject({ plan: "team", productId: PRODUCTS.teamYearly, clearPlan: false });
    expect(patch("subscription.updated", subscription({ product_id: undefined, product: { id: PRODUCTS.soloYearly } }))).toMatchObject({ plan: "solo" });
    for (const product_id of ["55555555-5555-4555-8555-555555555555", null]) {
      expect(patch("subscription.updated", subscription({ product_id, metadata: { plan: "team" } }))).toMatchObject({ plan: null, clearPlan: true });
    }
    expect(patch("subscription.updated", subscription({ status: "incomplete" }))).toMatchObject({ plan: null, clearPlan: false });
    expect(patch("subscription.updated", subscription({ metadata: { organizationId: "not-a-uuid", installationId: "7x" } })))
      .toMatchObject({ organizationId: null, installationId: null });
    expect(patch("order.paid", { id: "order_1" })).toBeNull();
    expect(patch("subscription.updated", { status: "active" })).toBeNull();
    expect(parsePolarEvent({ type: "subscription.updated", data: {} }, undefined)).toBeNull();
  });

  it("returns 503 without Polar settings and never invents a paid plan", async () => {
    await withStore(async ({ store }) => {
      const { admin } = await seedInstall(store);
      const app = createApp({
        config: loadConfig({
          databaseUrl: "pglite://:memory:",
          githubWebhookSecret: "wh",
          githubAppId: "1",
          githubPrivateKey: "x",
          githubClientId: "c",
          githubClientSecret: "s",
          sessionSecret: "sess",
        }),
        store,
        github: mockGithub(),
      });
      const health = await app.request("/api/health");
      const healthBody = (await health.json()) as { polar: boolean };
      expect(healthBody.polar).toBe(false);
      const checkout = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, plan: "solo", interval: "month" }),
      });
      expect(checkout.status).toBe(503);
      const checkoutBody = (await checkout.json()) as { error: string };
      expect(checkoutBody.error).toBe(POLAR_NOT_LIVE_ERROR);
      const hook = await app.request("/api/webhooks/polar", { method: "POST", body: "{}" });
      expect(hook.status).toBe(503);
      expect((await app.request("/api/webhooks/stripe", { method: "POST", body: "{}" })).status).not.toBe(200);
      const { rows } = await store.sql.query<{ plan: string | null }>(
        `SELECT plan FROM billing_accounts WHERE installation_id = 7`,
      );
      expect(rows[0]?.plan).toBe("trial");
    });
  });

  it("stays closed when two plans share one product or a value is missing", () => {
    expect(polarConfigured(loadConfig(polarConfig))).toBe(true);
    expect(polarConfigured(loadConfig({ ...polarConfig, polarProductTeamYearly: PRODUCTS.teamMonthly }))).toBe(false);
    expect(polarConfigured(loadConfig({ ...polarConfig, polarWebhookSecret: "" }))).toBe(false);
    expect(loadConfig({ ...polarConfig }).polarServer).toBe("production");
  });

  it("starts checkout for an admin, including unpaid installs, and blocks members and other tenants", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "u3", login: "intruder" });
      const { admin, member } = await seedInstall(store, { member: true, unpaid: true });
      const other = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      const calls: PolarCheckoutInput[] = [];
      const app = appFor(
        store,
        mockPolar({
          createCheckout: async (input) => {
            calls.push(input);
            return { id: "chk_1", url: "https://polar.sh/checkout/polar_c_1" };
          },
        }),
      );
      const started = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, plan: "team", interval: "year" }),
      });
      expect(started.status).toBe(200);
      const startedBody = (await started.json()) as { url: string; kind: string };
      expect(startedBody.kind).toBe("checkout");
      expect(startedBody.url).toMatch(/^https:\/\/polar\.sh\/checkout\//);
      expect(calls).toEqual([
        expect.objectContaining({
          productId: PRODUCTS.teamYearly,
          trialDays: 0,
          customerIpAddress: null,
          metadata: expect.objectContaining({ installationId: "7", plan: "team", interval: "year" }),
        }),
      ]);

      const asMember = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: member!, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, plan: "solo", interval: "month" }),
      });
      expect(asMember.status).toBe(403);

      const asOther = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: other, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, plan: "solo", interval: "month" }),
      });
      expect(asOther.status).toBe(403);

      const billing = await app.request("/api/billing?installationId=7", {
        headers: { cookie: admin },
      });
      const billingBody = (await billing.json()) as { billing: Record<string, unknown> };
      expect(JSON.stringify(billingBody)).not.toMatch(/cus_|sub_|polar_oat|whsec_|11111111|44444444/);
      expect(billingBody.billing.hasCustomer).toBe(false);
    });
  });

  it('requires organisation billing authority, not a workspace administrator grant, and survives source removal',async()=>{
    await withStore(async({store})=>{
      const {admin}=await seedInstall(store);
      await store.upsertUser({id:'guest-admin',login:'guest-admin'});
      const workspace=(await listUserWorkspaces(store.sql,'u1')).find(w=>Number(w.installation_id)===7)!;
      const invite=await inviteWorkspaceMember(store.sql,'u1',workspace.id,'guest-admin','member');
      await acceptWorkspaceInvite(store.sql,'guest-admin',invite.id);
      // Seed the explicit admin role through storage: this legacy workspace has no product owner yet.
      await store.sql.query("UPDATE product_workspace_members SET role='admin' WHERE workspace_id=$1 AND user_id='guest-admin'",[workspace.id]);
      await store.sql.query("UPDATE installation_users SET role='admin' WHERE installation_id=7 AND user_id='guest-admin'");
      const guest=`ns_session=${signSession('sess',await store.createSession('guest-admin'))}`;
      const app=appFor(store);
      const denied=await app.request('/api/billing/checkout',{method:'POST',headers:{cookie:guest,'content-type':'application/json'},body:JSON.stringify({installationId:7,plan:'solo',interval:'month'})});
      expect(denied.status).toBe(403);
      await store.sql.query("UPDATE installation_users SET role='viewer' WHERE installation_id=7 AND user_id='u1'");
      await store.sql.query("UPDATE billing_accounts SET polar_customer_id='cus_retained',polar_status='active' WHERE installation_id=7");
      const input={organizationId:workspace.organization_id};
      const portal=()=>app.request('/api/billing/portal',{method:'POST',headers:{cookie:admin,'content-type':'application/json'},body:JSON.stringify(input)});
      expect((await portal()).status).toBe(200);
      await store.deleteInstallation(7);
      expect((await portal()).status).toBe(200);
      expect((await app.request(`/api/billing?organizationId=${workspace.organization_id}`,{headers:{cookie:admin}})).status).toBe(200);
      expect((await store.sql.query('SELECT action FROM product_billing_events WHERE organization_id=$1',[workspace.organization_id])).rows).toEqual([{action:'portal'},{action:'portal'}]);
    });
  });

  it('reads source billing through its current organisation without a source billing account',async()=>{
    await withStore(async({store})=>{
      const {admin}=await seedInstall(store);
      const workspace=(await listUserWorkspaces(store.sql,'u1')).find(w=>Number(w.installation_id)===7)!;
      await store.sql.query("INSERT INTO installations(id,account_id,account_login,account_type) VALUES(98,98,'additional','Organization')");
      await store.sql.query('INSERT INTO product_workspace_installations(installation_id,workspace_id) VALUES(98,$1)',[workspace.id]);
      await store.sql.query("UPDATE billing_accounts SET polar_customer_id='cus_shared',polar_status='active',plan='team' WHERE installation_id=7");
      const app=appFor(store);
      const response=await app.request('/api/billing?installationId=98',{headers:{cookie:admin}});
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({billing:{hasCustomer:true,plan:'team'}});
      const portal=await app.request('/api/billing/portal',{method:'POST',headers:{cookie:admin,'content-type':'application/json'},body:JSON.stringify({installationId:98})});
      expect(portal.status).toBe(200);
      expect((await store.sql.query('SELECT organization_id FROM product_billing_events')).rows).toEqual([{organization_id:workspace.organization_id}]);
    });
  });

  it("opens the portal for an existing subscriber, including a past-due one, and refuses an account with no customer", async () => {
    await withStore(async ({ store }) => {
      const { admin } = await seedInstall(store);
      const checkouts: PolarCheckoutInput[] = [];
      const app = appFor(store, mockPolar({ createCheckout: async (input) => { checkouts.push(input); return { id: "chk", url: "https://polar.sh/checkout/x" }; } }));
      const empty = await app.request("/api/billing/portal", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7 }),
      });
      expect(empty.status).toBe(409);
      expect(((await empty.json()) as { error: string }).error).toBe(BILLING_SUBSCRIBE_FIRST_ERROR);

      await store.sql.query(
        `UPDATE billing_accounts
            SET polar_customer_id = 'cus_1', polar_subscription_id = 'sub_1',
                polar_status = 'active', plan = 'solo'
          WHERE installation_id = 7`,
      );
      const portal = await app.request("/api/billing/portal", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7 }),
      });
      expect(portal.status).toBe(200);
      expect(((await portal.json()) as { url: string; kind: string }).kind).toBe("portal");

      const checkout = () => app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, plan: "team", interval: "month" }),
      });
      expect(((await (await checkout()).json()) as { kind: string }).kind).toBe("portal");
      // A failed renewal is fixed in the portal, not by paying for a second subscription.
      await store.sql.query(`UPDATE billing_accounts SET polar_status = 'past_due', plan = NULL WHERE installation_id = 7`);
      expect(((await (await checkout()).json()) as { kind: string }).kind).toBe("portal");
      // Once the subscription has ended, checkout opens again for the same Polar customer.
      await store.sql.query(`UPDATE billing_accounts SET polar_status = 'canceled' WHERE installation_id = 7`);
      expect(((await (await checkout()).json()) as { kind: string }).kind).toBe("checkout");
      expect(checkouts).toEqual([expect.objectContaining({ customerId: "cus_1", productId: PRODUCTS.teamMonthly })]);
    });
  });

  it("applies signed lifecycle events idempotently, in order, and stops unpaid hosted work", async () => {
    await withStore(async ({ store }) => {
      await seedInstall(store);
      const app = appFor(store);
      const metadata = { installationId: "7", organizationId: "00000000-0000-4000-8000-000000000007", plan: "solo", interval: "month" };
      const created = subscription({ metadata });
      const first = await deliver(app, "msg_created", "subscription.created", created);
      expect(first.status).toBe(200);
      expect(await store.installationHasCoverage(7)).toBe(true);
      const { rows: paid } = await store.sql.query<{ plan: string | null; polar_customer_id: string | null; polar_product_id: string | null }>(
        `SELECT plan, polar_customer_id, polar_product_id FROM billing_accounts WHERE installation_id = 7`,
      );
      expect(paid[0]).toMatchObject({ plan: "solo", polar_customer_id: "cus_1", polar_product_id: PRODUCTS.soloMonthly });

      const replay = await deliver(app, "msg_created", "subscription.created", created);
      expect(((await replay.json()) as { duplicate: boolean }).duplicate).toBe(true);

      const pastDue = subscription({ status: "past_due", metadata });
      expect((await deliver(app, "msg_past_due", "subscription.past_due", pastDue)).status).toBe(200);
      expect(await store.installationHasCoverage(7)).toBe(false);
      expect(await store.installationWorkBlock(7)).toEqual({ reason: "unpaid" });

      // A delivery that Polar retried late carries an older version and must not undo the failure.
      const late = await deliver(app, "msg_late", "subscription.updated", { ...created, modified_at: "2026-11-26T09:30:00.000000Z" });
      expect(await late.json()).toMatchObject({ applied: false });
      expect(await store.installationHasCoverage(7)).toBe(false);

      expect((await deliver(app, "msg_recovered", "subscription.active", subscription({ metadata }))).status).toBe(200);
      expect(await store.installationHasCoverage(7)).toBe(true);

      // Cancelling at period end keeps coverage until Polar revokes the subscription.
      await deliver(app, "msg_cancel", "subscription.canceled", subscription({ cancel_at_period_end: true, metadata }));
      expect(await store.installationHasCoverage(7)).toBe(true);
      await deliver(app, "msg_revoked", "subscription.revoked", subscription({ status: "canceled", metadata }));
      expect(await store.installationHasCoverage(7)).toBe(false);

      // An ended subscription cannot be revived, even by a newer-looking delivery.
      expect(await (await deliver(app, "msg_revive", "subscription.updated", subscription({ metadata }))).json()).toMatchObject({ applied: false });
      expect(await store.installationHasCoverage(7)).toBe(false);

      // A fresh checkout for the same installation replaces the ended subscription.
      expect(await (await deliver(app, "msg_new", "subscription.created", subscription({ id: "sub_2", product_id: PRODUCTS.teamYearly, metadata }))).json()).toMatchObject({ applied: true });
      expect(await store.installationHasCoverage(7)).toBe(true);
      const { rows: replaced } = await store.sql.query<{ plan: string; polar_subscription_id: string; polar_retired_subscription_ids: string[] }>(
        `SELECT plan, polar_subscription_id, polar_retired_subscription_ids FROM billing_accounts WHERE installation_id = 7`,
      );
      expect(replaced[0]).toEqual({ plan: "team", polar_subscription_id: "sub_2", polar_retired_subscription_ids: ["sub_1"] });
      // The retired subscription's deliveries are ignored from now on.
      expect(await (await deliver(app, "msg_retired", "subscription.updated", subscription({ status: "canceled", metadata }))).json()).toMatchObject({ applied: false });
      expect(await store.installationHasCoverage(7)).toBe(true);
      // Other event types are acknowledged and ignored.
      expect(await (await deliver(app, "msg_order", "order.paid", { id: "order_1" })).json()).toMatchObject({ skipped: true });
    });
  });

  it("rejects a bad signature and will not move a subscription to another tenant", async () => {
    await withStore(async ({ store }) => {
      await seedInstall(store);
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      const app = appFor(store);
      const forged = await app.request("/api/webhooks/polar", {
        method: "POST",
        headers: { "webhook-id": "msg_bad", "webhook-timestamp": String(Math.floor(Date.now() / 1000)), "webhook-signature": "v1,bm9wZQ==" },
        body: JSON.stringify({ type: "subscription.created", data: subscription({ metadata: { installationId: "11" } }) }),
      });
      expect(forged.status).toBe(403);

      expect((await deliver(app, "msg_owner", "subscription.created", subscription({ metadata: { installationId: "7" } }))).status).toBe(200);
      const steal = await deliver(app, "msg_steal", "subscription.updated", subscription({ product_id: PRODUCTS.teamMonthly, metadata: { installationId: "11" } }));
      expect(await steal.json()).toMatchObject({ applied: false });
      const unbound = await deliver(app, "msg_unbound", "subscription.created", subscription({ id: "sub_orphan" }));
      expect(await unbound.json()).toMatchObject({ applied: false });
      const { rows } = await store.sql.query<{ installation: string; plan: string | null; polar_subscription_id: string | null }>(
        `SELECT installation_id::text AS installation, plan, polar_subscription_id FROM billing_accounts WHERE installation_id IN (7, 11) ORDER BY installation_id`,
      );
      expect(rows).toEqual([
        { installation: "7", plan: "solo", polar_subscription_id: "sub_1" },
        { installation: "11", plan: "trial", polar_subscription_id: null },
      ]);
    });
  });

  it("posts checkout JSON with the pinned API version and keeps the token out of the body", async () => {
    const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
    const respond = (payload: unknown) => async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(JSON.stringify(payload), { status: 201 });
    };
    const polar = createPolarPort("polar_oat_test", "sandbox", respond({ id: "chk_1", url: "https://sandbox.polar.sh/checkout/polar_c_1" }));
    const session = await polar.createCheckout({
      productId: PRODUCTS.soloMonthly,
      customerId: "cus_returning",
      successUrl: "https://example.test/watch?billing=ok",
      returnUrl: "https://example.test/watch?billing=canceled",
      trialDays: 3,
      customerIpAddress: "203.0.113.9",
      metadata: { installationId: "7", plan: "solo", interval: "month" },
    });
    expect(session.url).toBe("https://sandbox.polar.sh/checkout/polar_c_1");
    expect(calls[0]?.url).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer polar_oat_test");
    expect(calls[0]?.headers.get("polar-version")).toBe("2026-10");
    expect(calls[0]?.body).toEqual({
      products: [PRODUCTS.soloMonthly],
      success_url: "https://example.test/watch?billing=ok",
      return_url: "https://example.test/watch?billing=canceled",
      metadata: { installationId: "7", plan: "solo", interval: "month" },
      customer_id: "cus_returning",
      customer_ip_address: "203.0.113.9",
      allow_trial: true,
      trial_interval: "day",
      trial_interval_count: 3,
    });
    expect(JSON.stringify(calls[0]?.body)).not.toContain("polar_oat");

    const noTrial = createPolarPort("polar_oat_test", "production", respond({ id: "chk_2", url: "https://polar.sh/checkout/polar_c_2" }));
    await noTrial.createCheckout({ productId: PRODUCTS.teamYearly, successUrl: "https://e.test/ok", returnUrl: "https://e.test/back", trialDays: 0, metadata: {} });
    expect(calls[1]?.url).toBe("https://api.polar.sh/v1/checkouts/");
    expect(calls[1]?.body).toMatchObject({ allow_trial: false });
    expect(calls[1]?.body).not.toHaveProperty("trial_interval");
    expect(calls[1]?.body).not.toHaveProperty("customer_id");

    const portal = createPolarPort("polar_oat_test", "production", respond({ customer_portal_url: "https://polar.sh/nospoilers/portal?customer_session_token=x" }));
    expect(await portal.createPortalSession({ customerId: "cus_1", returnUrl: "https://e.test/back" })).toEqual({ url: "https://polar.sh/nospoilers/portal?customer_session_token=x" });
    expect(calls[2]?.url).toBe("https://api.polar.sh/v1/customer-sessions/");
    expect(calls[2]?.body).toEqual({ customer_id: "cus_1", return_url: "https://e.test/back" });

    const failing = createPolarPort("polar_oat_test", "production", async () => new Response(JSON.stringify({ detail: "secret detail" }), { status: 422 }));
    await expect(failing.createPortalSession({ customerId: "cus_1", returnUrl: "https://e.test" })).rejects.toThrow("Polar is unavailable");
  });
});

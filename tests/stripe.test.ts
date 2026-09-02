import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.ts";
import { loadConfig } from "../src/server/config.ts";
import { skippedGithubWrites, type GithubPort } from "../src/server/github.ts";
import { migrate, openSql, type SqlClient } from "../src/server/sql.ts";
import { createStore, signSession, type Store } from "../src/server/store.ts";
import {
  STRIPE_NOT_LIVE_ERROR,
  STRIPE_SUBSCRIBE_FIRST_ERROR,
  createStripePort,
  remainingTrialDays,
  stripeEventPatch,
  stripeSignature,
  verifyStripeSignature,
  type StripePort,
} from "../src/server/stripe.ts";

const SECRET = "whsec_test_stripe";
const PRICES = {
  soloMonthly: "price_solo_month",
  soloYearly: "price_solo_year",
  teamMonthly: "price_team_month",
  teamYearly: "price_team_year",
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

function mockStripe(overrides: Partial<StripePort> = {}): StripePort {
  return {
    createCheckoutSession: async () => ({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    }),
    createPortalSession: async () => ({
      url: "https://billing.stripe.com/p/session/test",
    }),
    ...overrides,
  };
}

const stripeConfig = {
  databaseUrl: "pglite://:memory:",
  githubWebhookSecret: "wh",
  githubAppId: "1",
  githubPrivateKey: "x",
  githubClientId: "c",
  githubClientSecret: "s",
  sessionSecret: "sess",
  stripeSecretKey: "sk_test_123",
  stripeWebhookSecret: SECRET,
  stripePriceSoloMonthly: PRICES.soloMonthly,
  stripePriceSoloYearly: PRICES.soloYearly,
  stripePriceTeamMonthly: PRICES.teamMonthly,
  stripePriceTeamYearly: PRICES.teamYearly,
};

function appFor(store: Store, stripe: StripePort | undefined = mockStripe()) {
  return createApp({
    config: loadConfig(stripe ? stripeConfig : { ...stripeConfig, stripeSecretKey: "" }),
    store,
    github: mockGithub(),
    stripe,
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

function signedEvent(event: Record<string, unknown>, timestamp = Math.floor(Date.now() / 1000)) {
  const body = JSON.stringify(event);
  return {
    body,
    signature: stripeSignature(SECRET, body, timestamp),
  };
}

describe("Stripe checkout and lifecycle", () => {
  it("applies migration 059_stripe_billing", async () => {
    await withStore(async ({ sql }) => {
      const { rows } = await sql.query<{ id: string }>(
        `SELECT id FROM schema_migrations WHERE id = '059_stripe_billing'`,
      );
      expect(rows.map((row) => row.id)).toEqual(["059_stripe_billing"]);
    });
  });

  it("verifies Stripe signatures and rejects stale or wrong ones", () => {
    const body = `{"id":"evt_1"}`;
    const now = 1_700_000_000_000;
    const header = stripeSignature(SECRET, body, Math.floor(now / 1000));
    expect(verifyStripeSignature(SECRET, body, header, now)).toBe(true);
    expect(verifyStripeSignature("other", body, header, now)).toBe(false);
    expect(verifyStripeSignature(SECRET, "{}", header, now)).toBe(false);
    expect(verifyStripeSignature(SECRET, body, header, now + 6 * 60 * 1000)).toBe(false);
  });

  it("maps remaining trial days and subscription patches", () => {
    expect(remainingTrialDays(new Date(Date.now() + 11 * 86_400_000).toISOString())).toBe(11);
    expect(remainingTrialDays("2000-01-01T00:00:00.000Z")).toBe(0);
    const paid = stripeEventPatch(
      {
        id: "evt_paid",
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_1",
            subscription: "sub_1",
            metadata: { installationId: "7" },
          },
        },
      },
      PRICES,
    );
    expect(paid).toMatchObject({ clearPlan: true, plan: null, customerId: "cus_1" });
  });

  it("returns 503 without keys and never invents a paid plan", async () => {
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
      const healthBody = (await health.json()) as { stripe: boolean };
      expect(healthBody.stripe).toBe(false);
      const checkout = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, plan: "solo", interval: "month" }),
      });
      expect(checkout.status).toBe(503);
      const checkoutBody = (await checkout.json()) as { error: string };
      expect(checkoutBody.error).toBe(STRIPE_NOT_LIVE_ERROR);
      const hook = await app.request("/api/webhooks/stripe", { method: "POST", body: "{}" });
      expect(hook.status).toBe(503);
      const { rows } = await store.sql.query<{ plan: string | null }>(
        `SELECT plan FROM billing_accounts WHERE installation_id = 7`,
      );
      expect(rows[0]?.plan).toBe("trial");
    });
  });

  it("starts Checkout for an admin, including unpaid installs, and blocks members and other tenants", async () => {
    await withStore(async ({ store }) => {
      await store.upsertUser({ id: "u3", login: "intruder" });
      const { admin, member } = await seedInstall(store, { member: true, unpaid: true });
      const other = `ns_session=${signSession("sess", await store.createSession("u3"))}`;
      const calls: unknown[] = [];
      const app = appFor(
        store,
        mockStripe({
          createCheckoutSession: async (input) => {
            calls.push(input);
            return { id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" };
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
      expect(startedBody.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
      expect(calls).toEqual([
        expect.objectContaining({
          priceId: PRICES.teamYearly,
          trialPeriodDays: 0,
          metadata: expect.objectContaining({ installationId: "7", plan: "team", interval: "year" }),
        }),
      ]);

      const asMember = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: member, "content-type": "application/json" },
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
      expect(JSON.stringify(billingBody)).not.toMatch(/cus_|sub_|sk_|whsec_|price_/);
      expect(billingBody.billing.hasCustomer).toBe(false);
    });
  });

  it("opens the portal for an existing subscriber and refuses a customer without a card", async () => {
    await withStore(async ({ store }) => {
      const { admin } = await seedInstall(store);
      const app = appFor(store);
      const empty = await app.request("/api/billing/portal", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7 }),
      });
      expect(empty.status).toBe(409);
      expect(((await empty.json()) as { error: string }).error).toBe(STRIPE_SUBSCRIBE_FIRST_ERROR);

      await store.sql.query(
        `UPDATE billing_accounts
            SET stripe_customer_id = 'cus_1', stripe_subscription_id = 'sub_1',
                stripe_status = 'active', plan = 'solo'
          WHERE installation_id = 7`,
      );
      const portal = await app.request("/api/billing/portal", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7 }),
      });
      expect(portal.status).toBe(200);
      expect(((await portal.json()) as { url: string; kind: string }).kind).toBe("portal");

      const checkout = await app.request("/api/billing/checkout", {
        method: "POST",
        headers: { cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ installationId: 7, plan: "team", interval: "month" }),
      });
      expect(checkout.status).toBe(200);
      expect(((await checkout.json()) as { kind: string }).kind).toBe("portal");
    });
  });

  it("applies signed lifecycle events idempotently and stops unpaid hosted work", async () => {
    await withStore(async ({ store }) => {
      await seedInstall(store);
      const app = appFor(store);
      const completed = signedEvent({
        id: "evt_checkout",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            customer: "cus_1",
            subscription: "sub_1",
            client_reference_id: "7",
            metadata: { installationId: "7", plan: "solo", priceId: PRICES.soloMonthly },
          },
        },
      });
      const first = await app.request("/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": completed.signature },
        body: completed.body,
      });
      expect(first.status).toBe(200);
      expect(await store.installationHasCoverage(7)).toBe(true);
      const { rows: paid } = await store.sql.query<{ plan: string | null; stripe_customer_id: string | null }>(
        `SELECT plan, stripe_customer_id FROM billing_accounts WHERE installation_id = 7`,
      );
      expect(paid[0]).toMatchObject({ plan: "solo", stripe_customer_id: "cus_1" });

      const replay = await app.request("/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": completed.signature },
        body: completed.body,
      });
      expect(replay.status).toBe(200);
      expect(((await replay.json()) as { duplicate: boolean }).duplicate).toBe(true);

      const failed = signedEvent({
        id: "evt_fail",
        type: "invoice.payment_failed",
        data: {
          object: {
            customer: "cus_1",
            subscription: "sub_1",
          },
        },
      });
      const failRes = await app.request("/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": failed.signature },
        body: failed.body,
      });
      expect(failRes.status).toBe(200);
      expect(await store.installationHasCoverage(7)).toBe(false);
      expect(await store.installationWorkBlock(7)).toEqual({ reason: "unpaid" });

      const restored = signedEvent({
        id: "evt_paid",
        type: "invoice.paid",
        data: {
          object: {
            customer: "cus_1",
            subscription: "sub_1",
            lines: { data: [{ price: { id: PRICES.soloMonthly } }] },
          },
        },
      });
      const paidRes = await app.request("/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": restored.signature },
        body: restored.body,
      });
      expect(paidRes.status).toBe(200);
      expect(await store.installationHasCoverage(7)).toBe(true);

      const canceled = signedEvent({
        id: "evt_cancel",
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_1", customer: "cus_1" } },
      });
      const cancelRes = await app.request("/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": canceled.signature },
        body: canceled.body,
      });
      expect(cancelRes.status).toBe(200);
      expect(await store.installationHasCoverage(7)).toBe(false);
    });
  });

  it("rejects a bad signature and will not attach another tenant's customer", async () => {
    await withStore(async ({ store }) => {
      await seedInstall(store);
      await store.upsertInstallation({
        id: 11,
        accountLogin: "other",
        accountType: "User",
        accountId: 2,
      });
      const app = appFor(store);
      const forged = await app.request("/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=nope" },
        body: JSON.stringify({ id: "evt_bad", type: "checkout.session.completed" }),
      });
      expect(forged.status).toBe(400);

      const first = signedEvent({
        id: "evt_owner",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_1",
            subscription: "sub_1",
            metadata: { installationId: "7", plan: "solo", priceId: PRICES.soloMonthly },
          },
        },
      });
      expect(
        (
          await app.request("/api/webhooks/stripe", {
            method: "POST",
            headers: { "stripe-signature": first.signature },
            body: first.body,
          })
        ).status,
      ).toBe(200);

      const steal = signedEvent({
        id: "evt_steal",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_1",
            subscription: "sub_9",
            metadata: { installationId: "11", plan: "team", priceId: PRICES.teamMonthly },
          },
        },
      });
      const stolen = await app.request("/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": steal.signature },
        body: steal.body,
      });
      expect(stolen.status).toBe(200);
      const { rows } = await store.sql.query<{ plan: string | null; stripe_customer_id: string | null }>(
        `SELECT plan, stripe_customer_id FROM billing_accounts WHERE installation_id = 11`,
      );
      expect(rows[0]?.stripe_customer_id).toBeNull();
      expect(rows[0]?.plan).toBe("trial");
    });
  });

  it("posts Checkout form fields without putting secrets in the body", async () => {
    const calls: { url: string; headers: Headers; body: string }[] = [];
    const stripe = createStripePort("sk_test_123", async (input, init) => {
      calls.push({
        url: String(input),
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ""),
      });
      return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }), {
        status: 200,
      });
    });
    const session = await stripe.createCheckoutSession({
      priceId: PRICES.soloMonthly,
      successUrl: "https://example.test/watch",
      cancelUrl: "https://example.test/pricing",
      clientReferenceId: "7",
      trialPeriodDays: 11,
      metadata: { installationId: "7", plan: "solo", interval: "month", priceId: PRICES.soloMonthly },
    });
    expect(session.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(calls[0]?.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(calls[0]?.body).toContain("payment_method_collection=always");
    expect(calls[0]?.body).toContain("subscription_data%5Btrial_period_days%5D=11");
    expect(calls[0]?.body).not.toContain("sk_test");
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer sk_test_123");
  });
});

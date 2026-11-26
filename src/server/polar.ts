import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Polar (polar.sh) is the merchant of record for NoSpoilers subscriptions.
 * Checkout and the customer portal are hosted by Polar; this module only
 * creates sessions, verifies signed webhooks and turns subscription events
 * into a provider-neutral entitlement patch.
 */

export const POLAR_NOT_LIVE_ERROR =
  "Checkout through Polar is not live on this host. Set the Polar access token, webhook secret and product IDs.";
export const BILLING_PLAN_ERROR = "Choose Solo or Team, monthly or yearly.";
export const BILLING_ADMIN_ERROR = "An install admin has to start checkout or open billing.";
export const BILLING_SUBSCRIBE_FIRST_ERROR = "Subscribe first, then manage billing.";
export const POLAR_UNAVAILABLE_ERROR = "Polar is unavailable. Try again in a minute.";

/** Requests and webhook payloads are read against this Polar API version. */
export const POLAR_API_VERSION = "2026-10";

export type BillingPlan = "solo" | "team";
export type BillingInterval = "month" | "year";
export type PolarServer = "production" | "sandbox";

export type PolarProductMap = {
  soloMonthly: string;
  soloYearly: string;
  teamMonthly: string;
  teamYearly: string;
};

export type PolarCheckoutInput = {
  productId: string;
  /** Existing Polar customer for this billing account, so a returning subscriber is not duplicated. */
  customerId?: string | null;
  successUrl: string;
  returnUrl: string;
  /** Days left on the NoSpoilers trial. Zero turns any product trial off. */
  trialDays: number;
  metadata: Record<string, string>;
  customerIpAddress?: string | null;
};

export type PolarPortalInput = {
  customerId: string;
  returnUrl: string;
};

export type PolarPort = {
  createCheckout: (input: PolarCheckoutInput) => Promise<{ id: string; url: string }>;
  createPortalSession: (input: PolarPortalInput) => Promise<{ url: string }>;
};

export type PolarEvent = {
  /** The `webhook-id` header: stable across Polar's retries of the same event. */
  id: string;
  type: string;
  data: Record<string, unknown>;
};

export type PolarBillingPatch = {
  eventType: string;
  organizationId: string | null;
  installationId: number | null;
  customerId: string | null;
  subscriptionId: string;
  status: string | null;
  productId: string | null;
  periodEnd: string | null;
  /** Polar's modification time for this version of the subscription; orders late deliveries. */
  modifiedAt: string | null;
  plan: BillingPlan | null;
  clearPlan: boolean;
};

export class PolarApiError extends Error {
  readonly status: number;
  constructor(message = POLAR_UNAVAILABLE_ERROR, status = 502) {
    super(message);
    this.name = "PolarApiError";
    this.status = status;
  }
}

export function parseBillingPlan(value: unknown): BillingPlan | null {
  return value === "solo" || value === "team" ? value : null;
}

export function parseBillingInterval(value: unknown): BillingInterval | null {
  return value === "month" || value === "year" ? value : null;
}

export function parsePolarServer(value: string): PolarServer {
  return value.trim().toLowerCase() === "sandbox" ? "sandbox" : "production";
}

export function polarProductId(products: PolarProductMap, plan: BillingPlan, interval: BillingInterval): string {
  if (plan === "solo") return interval === "year" ? products.soloYearly : products.soloMonthly;
  return interval === "year" ? products.teamYearly : products.teamMonthly;
}

export function planFromPolarProduct(products: PolarProductMap, productId: string | null | undefined): BillingPlan | null {
  if (!productId) return null;
  if (productId === products.soloMonthly || productId === products.soloYearly) return "solo";
  if (productId === products.teamMonthly || productId === products.teamYearly) return "team";
  return null;
}

export function remainingTrialDays(trialEndsAt: string | Date | null | undefined, now = Date.now()): number {
  if (!trialEndsAt) return 0;
  const end = typeof trialEndsAt === "string" ? Date.parse(trialEndsAt) : trialEndsAt.getTime();
  if (!Number.isFinite(end) || end <= now) return 0;
  return Math.max(1, Math.ceil((end - now) / 86_400_000));
}

/** Statuses that grant hosted scanning and monitoring. */
export function polarSubscriptionCovers(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Statuses a subscription does not come back from. A new checkout may replace
 * one of these; anything else (past due, paused, incomplete) is fixed in the portal.
 */
export function polarSubscriptionEnded(status: string | null | undefined): boolean {
  return status === "canceled" || status === "incomplete_expired" || status === "unpaid" || status === "trial_ended";
}

// ---------------------------------------------------------------------------
// Webhook signatures (Standard Webhooks, plus Polar's earlier key derivation)
// ---------------------------------------------------------------------------

export type PolarWebhookHeaders = {
  id: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
};

type SigningScheme = "standard" | "legacy";

function signingKey(secret: string, scheme: SigningScheme): Buffer | null {
  if (scheme === "legacy") return Buffer.from(secret, "utf8");
  // Standard Webhooks: the secret is `whsec_` followed by the base64 key.
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const key = Buffer.from(encoded, "base64");
  return key.length ? key : null;
}

function signatureFor(key: Buffer, id: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
}

/** Builds the headers Polar sends, for tests and local replay tools. */
export function polarWebhookHeaders(
  secret: string,
  id: string,
  rawBody: string,
  timestampSeconds = Math.floor(Date.now() / 1000),
  scheme: SigningScheme = "standard",
): Record<string, string> {
  const key = signingKey(secret, scheme);
  if (!key) throw new Error("This secret cannot sign with that scheme.");
  const timestamp = String(timestampSeconds);
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signatureFor(key, id, timestamp, rawBody)}`,
  };
}

/**
 * Verifies a Polar delivery. Secrets created on or after 8 September 2026 use
 * Standard Webhooks; older ones sign with the UTF-8 bytes of the whole secret.
 * Both are tried, as Polar's own SDKs do.
 */
export function verifyPolarWebhook(
  secret: string,
  rawBody: string,
  headers: PolarWebhookHeaders,
  now = Date.now(),
  toleranceMs = 5 * 60 * 1000,
): boolean {
  const id = headers.id?.trim();
  const timestamp = headers.timestamp?.trim();
  const signatureHeader = headers.signature?.trim();
  if (!secret || !id || !timestamp || !signatureHeader) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp) * 1000) > toleranceMs) return false;
  const offered = signatureHeader
    .split(/\s+/)
    .map((part) => {
      const comma = part.indexOf(",");
      return comma > 0 && part.slice(0, comma) === "v1" ? part.slice(comma + 1) : "";
    })
    .filter(Boolean)
    .map((value) => Buffer.from(value));
  if (!offered.length) return false;
  for (const scheme of ["standard", "legacy"] as const) {
    const key = signingKey(secret, scheme);
    if (!key) continue;
    const expected = Buffer.from(signatureFor(key, id, timestamp, rawBody));
    if (offered.some((candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected))) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asIso(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? text : null;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function organizationIdFrom(metadata: Record<string, unknown>): string | null {
  const id = asString(metadata.organizationId);
  return id && UUID.test(id) ? id : null;
}

function installationIdFrom(metadata: Record<string, unknown>): number | null {
  const raw = metadata.installationId;
  const id = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function parsePolarEvent(raw: unknown, webhookId: string | undefined): PolarEvent | null {
  const obj = asRecord(raw);
  const id = asString(webhookId);
  const type = asString(obj.type);
  if (!id || id.length > 200 || !type) return null;
  return { id, type, data: asRecord(obj.data) };
}

/**
 * Every `subscription.*` event carries the whole subscription, so entitlement
 * follows its `status` and `product_id` rather than the event name. A
 * cancellation at period end stays `active` until Polar revokes it.
 */
export function polarSubscriptionPatch(event: PolarEvent, products: PolarProductMap): PolarBillingPatch | null {
  if (!event.type.startsWith("subscription.")) return null;
  const subscription = event.data;
  const subscriptionId = asString(subscription.id);
  if (!subscriptionId) return null;
  const status = asString(subscription.status);
  const productId = asString(subscription.product_id) ?? asString(asRecord(subscription.product).id);
  const productPlan = planFromPolarProduct(products, productId);
  const covers = polarSubscriptionCovers(status);
  const metadata = asRecord(subscription.metadata);
  return {
    eventType: event.type,
    organizationId: organizationIdFrom(metadata),
    installationId: installationIdFrom(metadata),
    customerId: asString(subscription.customer_id) ?? asString(asRecord(subscription.customer).id),
    subscriptionId,
    status,
    productId,
    periodEnd: asIso(subscription.current_period_end),
    modifiedAt: asIso(subscription.modified_at) ?? asIso(subscription.created_at),
    plan: covers ? productPlan : null,
    clearPlan: productPlan === null || (!covers && status !== "incomplete"),
  };
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export function polarApiBase(server: PolarServer): string {
  return server === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh";
}

export function createPolarPort(
  accessToken: string,
  server: PolarServer = "production",
  fetchFn: typeof fetch = fetch,
): PolarPort {
  async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchFn(`${polarApiBase(server)}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "Polar-Version": POLAR_API_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new PolarApiError();
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = asRecord(await response.json());
    } catch {
      parsed = {};
    }
    if (!response.ok) throw new PolarApiError();
    return parsed;
  }

  return {
    async createCheckout(input) {
      const body: Record<string, unknown> = {
        products: [input.productId],
        success_url: input.successUrl,
        return_url: input.returnUrl,
        metadata: input.metadata,
      };
      if (input.customerId) body.customer_id = input.customerId;
      if (input.customerIpAddress) body.customer_ip_address = input.customerIpAddress;
      if (input.trialDays > 0) {
        body.allow_trial = true;
        body.trial_interval = "day";
        body.trial_interval_count = Math.min(1000, Math.floor(input.trialDays));
      } else {
        // The trial belongs to the NoSpoilers account, not to each checkout.
        body.allow_trial = false;
      }
      const checkout = await post("/v1/checkouts/", body);
      const url = asString(checkout.url);
      const id = asString(checkout.id);
      if (!url || !id) throw new PolarApiError();
      return { id, url };
    },

    async createPortalSession(input) {
      const session = await post("/v1/customer-sessions/", {
        customer_id: input.customerId,
        return_url: input.returnUrl,
      });
      const url = asString(session.customer_portal_url);
      if (!url) throw new PolarApiError();
      return { url };
    },
  };
}

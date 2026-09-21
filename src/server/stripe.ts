import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_NOT_LIVE_ERROR =
  "Card checkout through Stripe is not live on this host. Set the Stripe keys and price IDs.";
export const STRIPE_PLAN_ERROR = "Choose Solo or Team, monthly or yearly.";
export const STRIPE_ADMIN_ERROR = "An install admin has to start checkout or open billing.";
export const STRIPE_SUBSCRIBE_FIRST_ERROR = "Subscribe first, then manage billing.";
export const STRIPE_UNAVAILABLE_ERROR = "Stripe is unavailable. Try again in a minute.";

export type StripePlan = "solo" | "team";
export type StripeInterval = "month" | "year";

export type StripePriceMap = {
  soloMonthly: string;
  soloYearly: string;
  teamMonthly: string;
  teamYearly: string;
};

export type StripeCheckoutInput = {
  customerId?: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId: string;
  trialPeriodDays: number;
  metadata: Record<string, string>;
};

export type StripePortalInput = {
  customerId: string;
  returnUrl: string;
};

export type StripePort = {
  createCheckoutSession: (input: StripeCheckoutInput) => Promise<{ id: string; url: string }>;
  createPortalSession: (input: StripePortalInput) => Promise<{ url: string }>;
};

export type StripeEvent = {
  id: string;
  created?: number;
  type: string;
  data: { object: Record<string, unknown> };
};

export type StripeBillingPatch = {
  eventCreated?: number;
  eventType?: string;
  organizationId?: string | null;
  installationId: number | null;
  customerId: string | null;
  subscriptionId: string | null;
  status: string | null;
  priceId: string | null;
  periodEnd: string | null;
  plan: StripePlan | null;
  clearPlan: boolean;
};

export class StripeApiError extends Error {
  readonly status: number;
  constructor(message = STRIPE_UNAVAILABLE_ERROR, status = 502) {
    super(message);
    this.name = "StripeApiError";
    this.status = status;
  }
}

export function parseStripePlan(value: unknown): StripePlan | null {
  return value === "solo" || value === "team" ? value : null;
}

export function parseStripeInterval(value: unknown): StripeInterval | null {
  return value === "month" || value === "year" ? value : null;
}

export function stripePriceId(prices: StripePriceMap, plan: StripePlan, interval: StripeInterval): string {
  if (plan === "solo") return interval === "year" ? prices.soloYearly : prices.soloMonthly;
  return interval === "year" ? prices.teamYearly : prices.teamMonthly;
}

export function planFromStripePrice(prices: StripePriceMap, priceId: string | null | undefined): StripePlan | null {
  if (!priceId) return null;
  if (priceId === prices.soloMonthly || priceId === prices.soloYearly) return "solo";
  if (priceId === prices.teamMonthly || priceId === prices.teamYearly) return "team";
  return null;
}

export function remainingTrialDays(trialEndsAt: string | Date | null | undefined, now = Date.now()): number {
  if (!trialEndsAt) return 0;
  const end = typeof trialEndsAt === "string" ? Date.parse(trialEndsAt) : trialEndsAt.getTime();
  if (!Number.isFinite(end) || end <= now) return 0;
  return Math.max(1, Math.ceil((end - now) / 86_400_000));
}

export function stripeSubscriptionCovers(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export function stripeSignature(secret: string, rawBody: string, timestamp: number): string {
  const signed = `${timestamp}.${rawBody}`;
  const digest = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

export function verifyStripeSignature(
  secret: string,
  rawBody: string,
  header: string | undefined,
  now = Date.now(),
  toleranceMs = 5 * 60 * 1000,
): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const eq = part.indexOf("=");
      return eq > 0 ? [part.slice(0, eq).trim(), part.slice(eq + 1).trim()] : ["", ""];
    }),
  );
  const timestamp = Number(parts.t);
  const expected = parts.v1;
  if (!Number.isFinite(timestamp) || !expected) return false;
  if (Math.abs(now - timestamp * 1000) > toleranceMs) return false;
  const signed = `${timestamp}.${rawBody}`;
  const digest = createHmac("sha256", secret).update(signed).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(digest);
  return a.length === b.length && timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const obj = asRecord(value);
  return asString(obj.id);
}

function asUnixMs(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function metadataOf(value: unknown): Record<string, unknown> {
  return asRecord(asRecord(value).metadata);
}

function firstSubscriptionItem(object: Record<string, unknown>): Record<string, unknown> {
  const items = asRecord(object.items);
  const data = items.data;
  if (!Array.isArray(data) || data.length === 0) return {};
  return asRecord(data[0]);
}

function priceIdFromObject(object: Record<string, unknown>): string | null {
  // API 2024-06-20 exposes the current subscribed price on items, not metadata.
  // This product sells one plan per subscription; partial or conflicting items
  // cannot establish an entitlement by selecting whichever item came first.
  const items=asRecord(object.items);
  if(items.has_more===true||!Array.isArray(items.data)||!items.data.length)return null;
  const ids=items.data.map(item=>asId(asRecord(item).price));
  if(ids.some(id=>id===null))return null;
  const unique=new Set(ids);
  return unique.size===1?ids[0]:null;
}

function periodEndFromObject(object: Record<string, unknown>): string | null {
  return (
    asUnixMs(object.current_period_end) ??
    asUnixMs(firstSubscriptionItem(object).current_period_end) ??
    asUnixMs(object.period_end)
  );
}

function installationIdFrom(value: unknown): number | null {
  const meta = metadataOf(value);
  const raw = meta.installationId ?? meta.installation_id ?? asRecord(value).client_reference_id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function organizationIdFrom(value: unknown): string | null {
  const id=asString(metadataOf(value).organizationId);
  return id&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)?id:null;
}

export function parseStripeEvent(raw: unknown): StripeEvent | null {
  const obj = asRecord(raw);
  const id = asString(obj.id);
  const type = asString(obj.type);
  if (!id || !type) return null;
  return { id, type, ...(Number.isSafeInteger(obj.created)&&Number(obj.created)>0?{created:Number(obj.created)}:{}), data: { object: asRecord(asRecord(obj.data).object) } };
}

export function stripeEventPatch(event: StripeEvent, prices: StripePriceMap): StripeBillingPatch | null {
  const patch=eventPatch(event,prices);
  return patch&&event.created?{...patch,eventCreated:event.created,eventType:event.type}:patch;
}
function eventPatch(event: StripeEvent, prices: StripePriceMap): StripeBillingPatch | null {
  const object = event.data.object;
  if (event.type === "checkout.session.completed") {
    if (asString(object.mode) && object.mode !== "subscription") return null;
    const priceId = asString(metadataOf(object).priceId) ?? asString(metadataOf(object).price_id);
    const plan=planFromStripePrice(prices,priceId);
    return {
      installationId: installationIdFrom(object),
      ...(organizationIdFrom(object)?{organizationId:organizationIdFrom(object)}:{}),
      customerId: asId(object.customer),
      subscriptionId: asId(object.subscription),
      status: remainingTrialDaysFromSession(object) > 0 ? "trialing" : "active",
      priceId,
      periodEnd: periodEndFromObject(object),
      plan,
      clearPlan: plan===null,
    };
  }
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const status = asString(object.status);
    const priceId = priceIdFromObject(object);
    const plan = planFromStripePrice(prices, priceId);
    const covers = stripeSubscriptionCovers(status);
    return {
      installationId: installationIdFrom(object),
      ...(organizationIdFrom(object)?{organizationId:organizationIdFrom(object)}:{}),
      customerId: asId(object.customer),
      subscriptionId: asId(object.id) ?? asId(object.subscription),
      status,
      priceId,
      periodEnd: periodEndFromObject(object),
      plan: covers ? plan : null,
      clearPlan: plan===null || (Boolean(status) && !covers && status !== "incomplete"),
    };
  }
  if (event.type === "customer.subscription.deleted") {
    return {
      installationId: installationIdFrom(object),
      ...(organizationIdFrom(object)?{organizationId:organizationIdFrom(object)}:{}),
      customerId: asId(object.customer),
      subscriptionId: asId(object.id) ?? asId(object.subscription),
      status: "canceled",
      priceId: priceIdFromObject(object),
      periodEnd: periodEndFromObject(object),
      plan: null,
      clearPlan: true,
    };
  }
  if (event.type === "invoice.paid") {
    const priceId = invoicePriceId(object);
    return {
      installationId: installationIdFrom(object),
      ...(organizationIdFrom(object)?{organizationId:organizationIdFrom(object)}:{}),
      customerId: asId(object.customer),
      subscriptionId: asId(object.subscription),
      status: "active",
      priceId,
      periodEnd: periodEndFromObject(object),
      plan: planFromStripePrice(prices, priceId),
      clearPlan: planFromStripePrice(prices, priceId)===null,
    };
  }
  if (event.type === "invoice.payment_failed") {
    return {
      installationId: installationIdFrom(object),
      ...(organizationIdFrom(object)?{organizationId:organizationIdFrom(object)}:{}),
      customerId: asId(object.customer),
      subscriptionId: asId(object.subscription),
      status: "past_due",
      priceId: invoicePriceId(object),
      periodEnd: periodEndFromObject(object),
      plan: null,
      clearPlan: true,
    };
  }
  return null;
}

function remainingTrialDaysFromSession(object: Record<string, unknown>): number {
  const sub = asRecord(object.subscription_data);
  const days = Number(sub.trial_period_days ?? object.trial_period_days);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

function invoicePriceId(object: Record<string, unknown>): string | null {
  const subscription=asRecord(object.subscription);
  if(subscription.items!==undefined)return priceIdFromObject(subscription);
  const lines=asRecord(object.lines);
  if(lines.has_more===true||!Array.isArray(lines.data))return null;
  const subscriptionId=asId(object.subscription);
  // Portal changes may put the old plan's credit before the new plan's charge.
  // Only subscription charges for this invoice can identify the paid plan.
  const charges=lines.data.map(asRecord).filter(line=>
    (line.type===undefined||line.type==='subscription')&&
    !(typeof line.amount==='number'&&line.amount<0)&&
    (!asId(line.subscription)||asId(line.subscription)===subscriptionId));
  if(!charges.length)return null;
  const ids=charges.map(line=>asId(line.price));
  if(ids.some(id=>id===null))return null;
  const unique=new Set(ids);
  return unique.size===1?ids[0]:null;
}

export function createStripePort(secretKey: string, fetchFn: typeof fetch = fetch): StripePort {
  async function formPost(path: string, fields: Record<string, string | undefined>): Promise<Record<string, unknown>> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      if (value != null && value !== "") body.set(key, value);
    }
    const response = await fetchFn(`https://api.stripe.com/v1${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body,
    });
    let parsed: Record<string, unknown> = {};
    try {
      parsed = asRecord(await response.json());
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      throw new StripeApiError();
    }
    return parsed;
  }

  return {
    async createCheckoutSession(input) {
      const fields: Record<string, string | undefined> = {
        mode: "subscription",
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.clientReferenceId,
        customer: input.customerId ?? undefined,
        payment_method_collection: "always",
        "line_items[0][price]": input.priceId,
        "line_items[0][quantity]": "1",
      };
      if (input.trialPeriodDays > 0) {
        fields["subscription_data[trial_period_days]"] = String(input.trialPeriodDays);
      }
      for (const [key, value] of Object.entries(input.metadata)) {
        fields[`metadata[${key}]`] = value;
        fields[`subscription_data[metadata][${key}]`] = value;
      }
      const session = await formPost("/checkout/sessions", fields);
      const url = asString(session.url);
      const id = asString(session.id);
      if (!url || !id) throw new StripeApiError();
      return { id, url };
    },

    async createPortalSession(input) {
      const session = await formPost("/billing_portal/sessions", {
        customer: input.customerId,
        return_url: input.returnUrl,
      });
      const url = asString(session.url);
      if (!url) throw new StripeApiError();
      return { url };
    },
  };
}

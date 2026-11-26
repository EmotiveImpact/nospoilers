# Billing with Polar

NoSpoilers takes payment through [Polar](https://polar.sh), which acts as merchant of record. Polar
sells the subscription, collects and remits sales tax and VAT, issues receipts and handles refunds.
The app never sees card details.

Billing stays closed until every setting below exists. Without them, `/api/billing/checkout`,
`/api/billing/portal` and `/api/webhooks/polar` answer 503 and `/api/health` reports `polar: false`.

## What the app does

| Piece | How it works |
| --- | --- |
| Checkout | `POST /api/billing/checkout` creates a Polar checkout for the chosen plan and interval and sends the customer to Polar's hosted page. Any days left on the five-day trial carry over to Polar. |
| Customer portal | "Manage subscription" opens Polar's customer portal for payment details, plan changes, invoices and cancellation. |
| Webhooks | `POST /api/webhooks/polar` verifies the Standard Webhooks signature, then records the subscription status, product, period end and plan on the billing account. Each delivery is applied once. Late or out-of-order deliveries cannot undo newer state. |
| Plan limits | Unchanged. The app reads the `plan` (`solo` or `team`) and trial columns the webhook writes. |
| Access | Still invitation-only. There is no free tier. |

Coverage counts while a subscription is `active` or `trialing`. A cancellation at period end keeps
coverage until the period ends, when Polar revokes the subscription. `past_due`, `unpaid`,
`canceled`, `incomplete_expired` and `trial_ended` stop coverage.

## Set up Polar (owner)

Do this first in the [Polar sandbox](https://sandbox.polar.sh), then repeat it in the live account.
Sandbox and live have separate organisations, products, tokens and webhook secrets.

1. **Organisation.** Use a Polar organisation dedicated to NoSpoilers. Leave "allow multiple
   subscriptions per customer" switched off.
2. **Products.** Create four recurring products, priced in USD at a fixed price, with **no trial on
   the product** (the app passes the remaining trial days itself). Keep them active, not archived.

   | Product name | Billing | Price |
   | --- | --- | --- |
   | NoSpoilers Solo (monthly) | Every month | $29 |
   | NoSpoilers Solo (yearly) | Every year | $290 |
   | NoSpoilers Team (monthly) | Every month | $99 |
   | NoSpoilers Team (yearly) | Every year | $990 |

   Copy each product's ID. The four IDs must all be different.
3. **Access token.** Settings, then Developers: create an organisation access token with the
   scopes `checkouts:write` and `customer_sessions:write`. Nothing else is needed.
4. **Webhook.** Settings, then Webhooks: add an endpoint.
   - URL: `https://<production domain>/api/webhooks/polar` (for the current production domain,
     `https://nospoilers.dev/api/webhooks/polar`). For the sandbox, point it at a preview or
     staging deployment that has the sandbox values.
   - Format: **Raw**.
   - Events: every `subscription.*` event, or at minimum `subscription.created` and
     `subscription.updated`.
   - Copy the signing secret (it starts with `whsec_`).
5. **Customer portal (optional).** If you want customers to switch between Solo and Team, or
   monthly and yearly, themselves, allow plan changes in Polar's customer portal settings. The app
   follows whichever of the four products Polar reports.

## Environment variables

### Vercel (web and API)

Set these on the **Production** environment with the live values. Optionally set the same names on
**Preview** with sandbox values and `POLAR_SERVER=sandbox`.

| Variable | Value |
| --- | --- |
| `POLAR_SERVER` | `production` (or `sandbox` for sandbox values) |
| `POLAR_ACCESS_TOKEN` | The organisation access token from step 3 |
| `POLAR_WEBHOOK_SECRET` | The webhook signing secret from step 4 |
| `POLAR_PRODUCT_SOLO_MONTHLY` | Product ID for Solo monthly |
| `POLAR_PRODUCT_SOLO_YEARLY` | Product ID for Solo yearly |
| `POLAR_PRODUCT_TEAM_MONTHLY` | Product ID for Team monthly |
| `POLAR_PRODUCT_TEAM_YEARLY` | Product ID for Team yearly |

`APP_BASE_URL` must already be the public https origin, because checkout success and cancel links
and the portal's return link are built from it. Redeploy after adding the variables, then check
that `/api/health` reports `polar: true`.

Any old `STRIPE_*` variables can be removed. Nothing reads them any more.

### Railway (worker)

Nothing. The worker does not serve billing routes; it reads the plan and trial columns from the
shared database like before.

## Test in the sandbox

1. Deploy a preview with the sandbox values and `POLAR_SERVER=sandbox`, and point the sandbox
   webhook at it.
2. Sign in as an invited user, open Workspaces, then Billing, pick a plan and continue to checkout.
3. Pay with the test card `4242 4242 4242 4242`, any future expiry and any CVC.
4. Back in the app, refresh billing. The plan should show as subscribed within a few seconds.
   Polar's webhook delivery log shows each delivery and the app's response.
5. Open "Manage subscription", cancel, and check the app keeps coverage until the period end.

## Costs

Polar's free Starter plan charges 5% + 50¢ per successful transaction. The Pro plan ($20 a month)
lowers that to 3.8% + 40¢. Cards issued outside the US add 1.5%. On a $29 Solo month that is
roughly $1.95 on Starter and $1.50 on Pro. See [Polar's fees page](https://polar.sh/docs/merchant-of-record/fees)
for current figures, payouts and disputes.

## Known limits

- Polar identifies a customer by email within one organisation. If one person pays for two
  NoSpoilers organisations with the same email, both subscriptions sit under one Polar customer,
  and the portal shows both.
- Past due stops coverage straight away, as it did before. Polar retries the payment, and coverage
  returns as soon as the subscription is active again.
- The old Stripe columns stay in the database, unused, so the migration is additive and nothing is
  dropped.

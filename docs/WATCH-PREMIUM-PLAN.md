# Watch desk extraction

**Done.** `WatchPage.tsx` is orchestration only (lazy workspace). Route markup lives under
`src/components/watch/screens/`. Live APIs, typed confirms, and role/plan gates were not rewritten.

Visual chrome is a separate track. Current spec is shot C:
[`/mockup-review/2b/21-stage-linear.html?shot=c`](../public/mockup-review/2b/21-stage-linear.html).
Status: [`docs/STATUS.md`](STATUS.md).

## What landed

- `WatchPage.tsx` / `WatchWorkspace.tsx` stay thin.
- One screen module per Watch route (Overview through Registries).
- URL remains durable state (`/watch`, `/watch/{view}`, query keys).
- Watch has no anonymous preview tenant. `/watch` and legacy `?as=trial|ended` URLs require GitHub authentication; trial and ended coverage come only from the authenticated installation.
- Ember stays on the homepage.

## What this file is not

It is not a product roadmap. Missing launch work (Stripe, Resend, Railway) is not a Watch
extraction gap. Ice features are in [`docs/ROADMAP.md`](ROADMAP.md).

## Remaining Watch presentation

- Keep canvas `#09090b`. Coral `#ff8a80` on real open/triage counts only.
- Apply Linear view tokens to `.watch-stage` only (shot C). Do not gray-wash the rail.
- Static comps stay in `/mockup-review/`. Link `*.html` files; directory URLs rewrite to the SPA.

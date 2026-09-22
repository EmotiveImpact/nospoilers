# Status

Latest checkpoint (22 September 2026): the fresh Vercel project/domain, shared Neon database,
Railway coordinator and Vercel Sandbox executor are configured. Production GitHub webhooks return
200 after a shared-secret repair, and bounded live clean/fail-closed/egress/timeout/cleanup Sandbox
checks passed. Migration `123_product_identity` separates product login identity from GitHub source
credentials, and the final source regression passed **1,665/1,665 tests
across 271 files**. Read [Authentication, enterprise access and scan workers](AUTH-ENTERPRISE-AND-WORKERS.md)
and [Bugs and fixes](../bugsandfixes.md) before older chronological notes.

**The product is a strong private-beta candidate. It is not yet accepted for public production.**

Watch, the scanner, GitHub connection flows, billing enforcement, Release Ledger, release
intelligence, Package Identity and the owner-only Disclosure Desk are implemented and tested.
Normal customer login is still GitHub-only until the new Neon account email is verified and Managed
Better Auth is connected. Stripe remains owner-deferred, real notification delivery is unaccepted,
and the complete hosted sign-in → GitHub connection → isolated scan → saved result journey still
needs proof. Remaining live sandbox adversarial checks and native accessibility checks are also open.

The exhaustive row-by-row ledger is [`docs/expansion/FEATURE-INVENTORY.md`](expansion/FEATURE-INVENTORY.md). What to do next is [`docs/ROADMAP.md`](ROADMAP.md). How to run the repo is [`README.md`](../README.md).

## Read these, not twelve copies of the same list

| File | Job |
| --- | --- |
| **This file** | Built vs live vs leftover vs ice |
| [`docs/ROADMAP.md`](ROADMAP.md) | What is left, in order |
| [`docs/PRODUCT.md`](PRODUCT.md) | What we sell, pricing, invariants |
| [`docs/AUTH-ENTERPRISE-AND-WORKERS.md`](AUTH-ENTERPRISE-AND-WORKERS.md) | Login, GitHub connectors, enterprise SSO/SCIM and workers |
| [`bugsandfixes.md`](../bugsandfixes.md) | Open launch issues and resolved defects |
| [`CHANGELOG.md`](../CHANGELOG.md) | What shipped, dated |
| [`docs/HANDOFF.md`](HANDOFF.md) | Live host facts for the next agent |
| [`docs/ACCESS-BOUNDARIES.md`](ACCESS-BOUNDARIES.md) | Who may see or change what |
| [`docs/expansion/FEATURE-INVENTORY.md`](expansion/FEATURE-INVENTORY.md) | Every discussed feature, one row |
| [`docs/products/README.md`](products/README.md) | Module vs separate-app boundary |
| [`docs/ELECTRON.md`](ELECTRON.md) | Why installers are on ice |
| [`docs/MONTH1.md`](MONTH1.md) | Acquisition guess after a real launch |

Older pause notes live in [`docs/PLATFORM-PAUSE.md`](PLATFORM-PAUSE.md) as a pointer here. The expansion PRD and module PRDs are specifications, not a second status board.

## Customer product — built in this repo

These exist as routes, APIs, workers, and tests. Watch is authenticated: `/watch`, `/watch?as=trial`, and `/watch?as=ended` require a signed product session. Production login currently enters through GitHub OAuth; the provider-neutral identity foundation is present for Neon Auth. Billing state comes only from the authorised organisation/source. Legacy `as` parameters are ignored. No preview tenant is rendered.

| Area | What is in |
| --- | --- |
| Scanner / CLI / Action | Directories and packed artifacts (tgz, zip, asar, VSIX/CRX/XPI, wheel/sdist, JAR/WAR, NuGet, gem, Docker/OCI, APK/AAB/IPA, serverless zip). Nested unpack, never execute. JSON/SARIF. Fail-closed CI fixtures. |
| Watch desk | 2B monolith: workspace-wide Overview plus source selection and an individual Release Readiness Brief for each persisted release. Package/source detail links resolve to the matching latest release when available. Alerts, Sources, Releases, Timeline, Setup, Notifications, Policy, Team, Retention, Audit, Health, Tokens, Registries remain on live APIs. |
| GitHub coverage | OAuth, fresh App install and owner-proved existing-personal reconnect, HMAC webhooks, queue, worker and hourly visibility poller. Publicize, created-public, cheap `.env`/`.map` push, and fixture release scan are proven on the throwaway. |
| npm / websites | Public and private registry watch, prerelease channels, unpublish fact. HTTPS origin crawl after ownership proof. Sentry/Bugsnag map custody. Provider-neutral `/api/v1/deploy`. |
| Policy / receipts | `.nospoilers.yml`, allowlists, baselines, HMAC receipts, Release Diff, SIZE-003, hosted `POST /api/v1/scan`. |
| Release Ledger | Append-only revisions with Mock 3-derived readiness detail, status-consistent proof steps, on-demand delivery verify, approve/reject/hold, public `/verify/:token`, attestation refresh (no Sigstore verify), signing policy. |
| Package Identity | Protect owned names, snapshots, lookalikes, namespace watch, evidence/advisory page, risk score. Not a malware verdict. |
| Team / alerts | Roles, GitHub-login invites, Slack/SIEM/Jira/PagerDuty, routing, audit, 90-day timeline, retention window, incident ack/assign/resolve. |
| GitHub response | Make-private, delete latest pack assets, disable a non-NoSpoilers workflow — **409 until Administration, which we will not grant.** Setup and remediation PRs are reviewable and never merged. |
| Fair use | Concurrency and daily unpack caps. Counts, not a credit meter. |

## Internal product — built, owner-only

Artifact Leads and Disclosure Desk at `/internal/prospects`. Public GitHub/npm discovery, verification, templates, do-not-contact, reports, destinations. **Nothing is mailed. Nothing is auto-sent to maintainers.** Customer sessions stay 401.

## Hosted and provider state

| Piece | Code | Live? |
| --- | --- | --- |
| Stripe Checkout, portal, lifecycle webhooks | Yes. 503 until keys and four price IDs | No. `/api/health` `stripe: false` |
| Resend Watch email | Yes. Destinations save; send 503 without keys | No. `resend: false`. Inbox stays GitHub-login only. Desk `sent` stays false |
| Vercel web/API | Yes | Fresh project and production domains are configured; verify each deployment against its intended commit |
| Neon Postgres | Yes | Vercel and Railway were verified against the same fresh Neon project |
| Railway worker | `railway.toml` + hosted preflight | Configured, Online, and using the shared Neon database |
| Vercel Sandbox | Fresh digest-pinned microVM per scan | Clean, encrypted fail-closed, denied-egress, timeout and stopped cleanup passed; special-file/oversize and worker-interruption checks remain |
| `nospoilers.dev` | Vercel production domain | Valid configuration; final hosted customer journey remains unaccepted |
| Neon Managed Better Auth | Provider-neutral database foundation is present | Not enabled; owner email verification and Auth endpoint setup remain |
| WorkOS SSO/SCIM | Architecture documented | Not configured; later enterprise add-on only |

Do not describe Stripe, email, Neon Auth, WorkOS or the complete customer journey as live merely
because their adapters or infrastructure foundations exist.

## Coded, not loop-proven on GitHub

| Event | Code | Live proof |
| --- | --- | --- |
| Created public, cheap push, private → public, fixture `release_scan` | Yes | `EmotiveImpact/nospoilers-throwaway` |
| App-generated setup PR | Yes | https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1 — leave open, never merge |
| Transfer, collaborator added, fork | Worker writes alerts | Needs a second GitHub account. Do not transfer the product repo. Do not invent `-vis` |
| Package Identity on a pack this install owns | Yes | No EmotiveImpact-owned npm package to protect |
| Hosted Checks write | Posts when granted | Not requested on the live App |
| Watch one-click containment | Typed confirm | 409 until Administration — do not grant it |

## On ice (do not start)

- Isolated Electron DMG / EXE / MSI / AppImage worker. The normal worker **skips** those assets and alerts. See [`docs/ELECTRON.md`](ELECTRON.md).
- CycloneDX/SPDX SBOM attachment.
- Sigstore / cosign / SLSA verification (adapters store presence only).
- Scheduled registry/CDN delivery polling (on-demand verify is built).
- WorkOS enterprise SSO/SAML/OIDC and SCIM. The provider-neutral identity foundation is built;
  configure the enterprise adapter only after explicit priority or customer demand.
- Native Vercel / Netlify / Cloudflare account OAuth (generic deploy trigger is built).
- Anonymized aggregate research from Artifact Leads.

## Not this repository

| Item | Why |
| --- | --- |
| Employee Public Footprint | Separate future app. Different legal basis. PRD only. |
| Automatic malware verdict or takedown | Do not build. |
| Automated outreach or public naming | Do not build. |
| Scan-credit pricing | Locked no. |
| Public Enterprise tile | Not until a customer asks. |
| CLI DRM | Distribution, not the bill. |

## Watch chrome

The live desk is the 2B monolith against real APIs. Screen modules are extracted; `WatchPage.tsx` is orchestration only.

Visual chrome is still being tightened against Linear comps in `/mockup-review/`. Shot C (Linear view tokens on `.watch-stage` only, rail stays canvas black) is specified at [`/mockup-review/2b/21-stage-linear.html?shot=c`](../public/mockup-review/2b/21-stage-linear.html). Applying C to live Watch is a UI PR, not a product-capability gap.

## Launch bar

1. Verify the fresh Neon account email, enable Managed Better Auth and prove customer sign-in and recovery.
2. Deploy the existing-personal GitHub reconnect, bind the live installation, then prove worker scan → saved result.
3. Complete live hostile-input, denied-egress, timeout and interruption cleanup checks for Vercel Sandbox.
4. Configure and prove one approved notification path without exposing private evidence.
5. Resolve the GitHub Actions account payment/spending-limit block and rerun CI.
6. Complete native 200% zoom and audible screen-reader checks.
7. Return to Stripe sandbox checkout and entitlement acceptance when the owner resumes billing work.

Until then, the product is suitable for controlled private beta rather than an open public launch.

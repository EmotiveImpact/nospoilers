# Changelog

## [Unreleased]

- Vercel now registers post-response job work with the official
  `@vercel/functions` `waitUntil` API. Previously, the response could freeze a
  claimed website scan and leave its Neon job in `running`. Production Web
  normalizes pasted dashboard/deep links to the public site root, gives each
  manual click a unique job, automatically refreshes until the result lands,
  and replaces “crawl” with plain website-scan language.

- Vercel cold starts no longer replay every database DDL migration. Runtime
  startup checks the current schema marker first; a fresh Postgres database
  serializes migration with a transaction-scoped advisory lock. Concurrent
  Watch API requests can no longer deadlock Neon while the UI waits on
  `/api/me`.

- Product positioning now names three coverage surfaces—GitHub Exposure,
  Release Artifacts, and Production Web—without presenting them as separate
  scanners. The landing page explains pre-release versus continuous hosted
  coverage; Watch labels `/sources` as Coverage and identifies the evidence
  source behind each result. Private Map Custody is explicitly a supporting
  proof, not another public-site scan.

- Source maps with populated `sourcesContent` are now reconstructed as bounded
  in-memory virtual files. Existing secret, private-key, credential,
  AI-context, internal-document, internal-route, and internal-location rules
  identify the original source path. Reports never retain reconstructed source
  or matched credential values.

- Production website/map crawls now use the heavy queue. Global and
  installation concurrency limits make bursts wait instead of reconstructing
  every customer map in memory simultaneously. Unchanged crawls still refund
  their daily hosted-unpack slot.

- Local GitHub sign-in now uses the stable loopback callback from the
  browser request instead of the changing public webhook tunnel. Non-local
  requests still use `APP_BASE_URL`. A successful sign-in returns to
  `/watch`.

- Watch views now put their decision, live information, and actions first.
  Detailed implementation guidance is available from `About` instead of
  filling every page. Sources has one live source list; Finish setup has a
  five-path checklist. Preview and the homepage product frame no longer
  invent repository or alert rows.

- Alerts and Releases now use the 2B list/detail panes while retaining the
  current live response, receipt, delivery, attestation, approval, and hold
  actions. Timeline derives a seven-day exposure chart from real alert
  intervals. Notification destinations/routes have summary cards, and
  source configuration is collapsed on the inventory view but expanded
  during Finish setup.

- Signed-in Watch is the 2B monolith sidebar (Overview, Alerts + views,
  Sources, Releases, Timeline, Finish setup, Settings). Ember stays on
  the homepage. Live APIs; no invented customer rows. Preview
  `/watch?as=trial` uses the same shell.

- Live App-generated setup PR on `EmotiveImpact/nospoilers-throwaway`:
  https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1 opened by
  `nospoilers-dev[bot]` from `nospoilers/setup` onto `main` after install
  `158159401` accepted Pull requests write. One file
  `.github/actions/nospoilers/action.yml`. Never merge. Workflow YAML stays
  copy-paste. Do not grant Administration or Workflows write. Do not invent
  `-vis`.

- Neon `LISTEN nospoilers_jobs` reconnects when the idle socket drops
  instead of crashing the process. Idle pool errors are logged. Recovery
  stays 15 minutes. This is not 500 ms empty-queue polling.

- `npm run phase1:setup-pr` opens the App-generated setup PR on
  `EmotiveImpact/nospoilers-throwaway` when Pull requests write is requested on
  the App and accepted on install `158159401`. Until then it prints the App
  permissions URL and the permission-update review URL. The install Configure
  page has no Accept until that Save. The App never merges. Workflow YAML stays
  copy-paste. Do not grant Administration or Workflows write. Do not invent
  `-vis`.

- Feature inventory now lists the human lookalike allowlist (already built)
  and records private → public on the throwaway proof row. Remaining
  specified work is human-gated or on ice. Do not invent `-vis`.

- Live GitHub publicize proof on `EmotiveImpact/nospoilers-throwaway` (repo
  `1353409756`, install `158159401`). Private → public 3 Sep 2026. First
  deliveries 502 while origin was down; redelivery 200 → jobs 52 and 53
  `done` → Watch alerts 41 and 42 `EmotiveImpact/nospoilers-throwaway is
  public`. Two rows because GitHub sends both `public` and
  `repository.publicized`. `npm run phase1:visibility` now targets this
  throwaway, not an invented `-vis` repo. Contents write still cannot
  change visibility. Optional `GITHUB_PROOF_TOKEN` on this disposable
  repo. Do not grant the App Administration. Transfer, collaborator, and
  fork stay unproven. Do not transfer. Do not publicize a product
  repository.

- Customer-managed signing policies: trial/Team admins require a present
  GitHub or npm attestation, or a builder prefix, before approve-to-ship.
  Optional expiration. Typed `signing-policy` / `clear-signing-policy`.
  Members may read. Solo is 403. Unpaid is 402. Clear deletes the row.
  Watch uses outline buttons, not ember. Migration
  `062_release_signing_policies`. Not Sigstore verification.
  Live Neon: `062` applied; unauth PUT 401; GET `{ policy: null }`;
  PUT require-github 200 as `EmotiveImpact` on install `158159401`;
  GET returned the policy; DELETE leftover policies 0; `watched_packages`
  0; open jobs 0.

- GitHub and public-npm attestation adapters refresh a sealed revision.
  Trial/Team install admins type the coordinate. The adapter stores
  presence, subject digest, predicate type, builder id, and issuer host.
  It does not verify Sigstore and does not store signature or bundle
  bytes. First refresh is a baseline. A later present document that
  disappears or changes writes a Watch fact. Solo is 403. Unpaid is 402.
  Hosted `api:` coordinates have no source. Private registries store
  `missing` and are not fetched. Watch uses outline Refresh attestations,
  not ember. Migration `061_release_attestations` is append-only.
  Live Neon: `061` applied; unauth GET/POST 401; throwaway
  `phase1-fixture` revision 6 (`c74219d2…`) POST 201 github `missing`
  baseline with no alert; second refresh left row 1 in place (2
  append-only rows); UPDATE rejected; `watched_packages` 0; open jobs 0.

- Home uses the PR #2 hero: two columns, two actions, CLI vs hosted cards.
  Log in stays on the hero. Ember token is `--color-ember`. GitHub PR #1
  (Neon) stays closed leftover — Neon already boots on `main`. PR #6
  (Stripe) was already merged.

- `npm run phase1:visibility` points the GitHub App webhook at
  `APP_BASE_URL/api/webhooks/github` and optionally publicizes
  `EmotiveImpact/nospoilers-throwaway` only. Contents write cannot change
  visibility (404/403). Live this session: App webhook pointed at the
  trycloudflare tunnel; cheap `.env.visibility-proof` push on
  `EmotiveImpact/nospoilers-throwaway` → job 51 `done` → Watch alert 40
  `Sensitive path in EmotiveImpact/nospoilers-throwaway`. Publicize is
  proven (jobs 52/53 → alerts 41/42). Transfer, collaborator, and fork
  stay unproven. Do not invent `-vis`. Do not grant the App
  Administration. Do not publicize a product repository.

- Production process split is in code. `npm run build` then `npm run host`
  serves the built SPA with the API. `NOSPOILERS_ROLE=web` serves HTTP and
  does not claim jobs. `NOSPOILERS_ROLE=worker` claims jobs and does not bind
  HTTP. A successful enqueue `NOTIFY`s `nospoilers_jobs` so a split worker
  wakes immediately. Recovery stays 15 minutes. `/api/health` reports `role`
  and `ui`. Live on this host: health `role: all`, `ui: true` after `npm run
  build`, `stripe: false`, `resend: false`, `database.mode: neon`. Built
  `dist/` serves `/watch` and `/docs` as HTML while `/api` stays JSON.
  Status shows those flags. This host is not on Railway. Not a purchase.

- Watch email destinations are wired through Resend. A covered install admin
  can save one address (encrypted). The API returns the domain and a redacted
  local part. Audit stores the domain only. Solo paid may save; unpaid is 402;
  members and other tenants are 403. Test and send stay 503 / `failed` until
  `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set. This host has no Resend
  keys (`/api/health` `resend: false`). A delivery test never invents a Watch
  alert. Disclosure Desk `sent` stays false. Invites stay GitHub-login only.
  Live Neon: migration `060_email_destinations` applied; email destinations 0;
  email deliveries 0; kind CHECKs include `email`. Live `/api/health` and
  `/api/me` report `resend: false`; unauth email POST and destination list are
  401. Watch preview shows no save-email form. Docs still say email alerts are
  not live yet. Not a live send.

- Stripe Checkout, Billing Portal, and signed lifecycle webhooks are wired.
  An install admin starts monthly/yearly Solo or Team Checkout. Checkout
  always collects a card and keeps remaining trial days. Failed payment or
  cancellation clears the plan so hosted work stops (GitHub still gets HTTP
  200). Events are idempotent. Members and other tenants cannot open
  Checkout or the portal. Responses never include customer, subscription,
  or price IDs. Routes return 503 until `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, and the four price IDs are set. This host has
  no Stripe keys (`/api/health` `stripe: false`). Live Neon: migration
  `059_stripe_billing` applied; `stripe_events` 0; no Stripe customer
  ids; columns present. Live `/api/health` reports `stripe: false`;
  unauth Checkout is 401; unsigned Stripe webhook is 503. Pricing shows
  Start trial / Open watch desk, not Subscribe monthly. Watch Subscribe
  after coverage ended returns to Pricing, not checkout.stripe.com.
  Not a Marketplace listing and not a live charge.

- Hosted website crawls enqueue as light jobs. The hourly poller and
  Check now no longer take a daily unpack slot at enqueue, so an
  unchanged site cannot block a GitHub Release scan. The worker
  consumes a slot only when it is about to scan (first crawl, changed
  bytes, or truncated). Unchanged sha256 and crawl errors never
  consume. A leftover heavy website job still refunds if it never
  scans. Check now is allowed at the daily cap so an unchanged check
  can finish. Live Neon: `watched_origins` 0; owner list empty;
  unauth 401; `web_origin_scan` jobs 0; no invented website watch;
  daily usage stayed 9; open jobs 0; Cloudflare tunnel matched. Not a
  scan-credit meter and not a Pricing change.

- Sentry/Bugsnag map custody checks enqueue as light jobs. They look up
  debug IDs or release names and never download map source, so they do
  not consume a daily hosted unpack slot. An npm scan that never
  downloads (missing private-registry token, or a tarball over the size
  cap) refunds its slot. Live Neon: `map_destinations` 0; owner list
  empty; unauth 401; no map_custody jobs; no invented Sentry/Bugsnag
  destination; open jobs 0. Not a scan-credit meter and not a Pricing
  change.

- Hosted unpack fair use refunds a GitHub Release job that never downloads
  (no Release, no scannable pack, Electron installer skip, or every pack
  over the size cap). `release.published` with no scannable pack enqueues
  a light job so it never consumes a daily unpack slot.   A packed download
  still counts. Live Neon: owner `scan-latest-release` on
  `EmotiveImpact/Echo` job 47 `done`; usage stayed 9; Watch alert 36
  skipped the Hearback installers; no new `v0.1.7` receipts; open jobs 0.
  Not a scan-credit meter and not a Pricing change.

- Hosted `release_scan` classifies Electron installer assets (DMG, EXE, MSI,
  AppImage, and mac/win desktop zip bundles such as
  `Hearback-0.1.7-arm64-mac.zip`) and skips them on the normal worker. The
  Watch alert names the skipped files. The worker does not download, unpack,
  or mint an inconclusive receipt for those assets. A later `release.edited`
  that only changes installer assets does not enqueue another heavy scan. A
  Release that also has a scannable pack still scans that pack. Live Neon:
  owner `scan-latest-release` on `EmotiveImpact/Echo` job 46 `done`; Watch
  alert 35 titles the skip and names the three Hearback installer assets;
  no new `v0.1.7` Hearback receipts; open jobs 0; Echo git tree not written.
  This is not the isolated Electron worker and not a Pricing change.

- Hosted `release_scan` resolves GitHub Checks against the tag name and
  `target_commitish`, not `tags/<tag>` as a commit SHA. A missing commit
  (GitHub 422/404) skips the Check and still writes the Watch alert.
  Live Neon: jobs 42 and 44 finished `done` after the `tags/v0.1.7` 422
  and wrote Watch `release_scan` alerts; leftover 422 errors 0; open jobs
  0. Not a Checks-write grant, not a write to another product repo, and
  not a Pricing change.

- Disclosure Desk findings: each case stores append-only
  `disclosure_findings` rows parsed from `rule|severity|path|title`
  fingerprints. Finding values are never stored. Case views and reports
  expose the structured rows. Customer sessions stay 401. No worker wake.
  Nothing is mailed. Live Neon: `058` applied; unauth and `not-admin` 401;
  prettier case has SEC-003 rows from existing fingerprints; left-pad has
  its recorded fingerprints; leftover extra findings 0; leftover extra
  orgs/contacts 0; leftover links 0; leftover grants 0; leftover
  destinations 0; no open jobs; campaigns 0; watches 0; Cloudflare tunnel
  matched. Not a customer product and not a Pricing change.

- Disclosure Desk security contacts and policies: each organization
  stores append-only contact and policy-URL records when a case saves
  those fields. The policy URL is the source on the contact when both
  are present. Case views and the organization list show them. Destination
  payloads include policy URLs, not contact emails. Customer sessions stay
  401. No worker wake. Nothing is mailed. Live Neon: `057` applied; unauth
  and `not-admin` 401; prettier has `security@prettier.io` and
  `https://prettier.io/security`; stevemao has none; leftover extra
  contacts/policies 0; leftover extra orgs 0; leftover links 0; leftover
  grants 0; leftover destinations 0; no open jobs; campaigns 0; watches 0;
  Cloudflare tunnel matched. Not a customer product and not a Pricing change.

- Disclosure Desk organizations and vendor domains: each case upserts a
  first-class organization from the GitHub owner. Saving a policy URL or
  security contact records an append-only vendor domain (forge and registry
  hosts are not stored). Cleared contact/policy keep the recorded domain so
  later duplicate matching still sees it. Case views, the owner/operator
  organization list, redacted reports, and destination payloads show the
  owner and hosts, never finding values. Not a commercial workspace.
  Customer sessions stay 401. No worker wake. Nothing is mailed. Live Neon:
  `056` applied; unauth and `not-admin` 401; owner list has prettier
  (`prettier.io` from the stored policy/contact) and stevemao (no vendor
  domain); prettier vs left-pad still no match; prettier stays
  `fixed`/`verified`; leftover extra orgs 0; leftover links 0; leftover
  grants 0; leftover destinations 0; no open jobs; campaigns 0; watches 0;
  Cloudflare tunnel matched. Not a customer product and not a Pricing change.

- Disclosure Desk duplicate links: a confirmed duplicate on case create or
  `contacted` stores an append-only `disclosure_duplicate_links` pair
  (owner/repo, organization, package, fingerprint, or domain). A 409
  without `confirmDuplicate` writes no row. The pair is stored once;
  a later confirm is idempotent. Case views, redacted reports, and
  destination payloads show the other owner/repo and reasons, never
  finding values. Customer sessions stay 401. No worker wake. Nothing
  is mailed. Live Neon: `055` applied; unauth and `not-admin` 401;
  owner desk 200; prettier vs left-pad still no match so both cases
  keep `duplicateLinks: []`; prettier stays `fixed`/`verified`; leftover
  links 0; leftover grants 0; leftover destinations 0; no open jobs;
  campaigns 0; watches 0; Cloudflare tunnel matched. Not a customer
  product and not a Pricing change.

- Disclosure Desk reproducibility steps: a case stores operator-written steps
  for how the public artifact finding was reproduced. A new `reproduced`
  checklist item and a new `verified` state require that text. Historical
  verified cases without steps stay verified. Reports include the steps and
  still omit notes and attachment bytes. Customer sessions stay 401. No
  worker wake. Nothing is mailed. Live Neon: `054` applied; unauth and
  `not-admin` 401; owner desk 200; prettier and left-pad steps stay null
  (no case rewrite); leftover grants 0; leftover destinations 0; no open
  jobs; campaigns 0; watches 0; Cloudflare tunnel matched. Not a customer
  product and not a Pricing change.

- Disclosure Desk artifact hash: a completed prospect scan stores SHA-256 and
  SHA-512 of the scanned bytes. Cases, redacted reports, drafts, and destination
  payloads show the URL/version/hash. A new `verified` state requires a
  64-hex SHA-256. A historical verified case without a hash stays verified.
  Customer sessions stay 401. No worker wake. Nothing is mailed. Live Neon:
  `053` applied; unauth and `not-admin` 401; owner desk 200; prettier and
  left-pad hashes stay null (no rescan); leftover grants 0; leftover
  destinations 0; no open jobs; campaigns 0; watches 0; Cloudflare tunnel
  matched. Not a customer product and not a Pricing change.

- Disclosure Desk duplicate warning before outreach: recording `contacted`
  now 409s on the same organization/domain/artifact/fingerprint matches as
  case create unless `confirmDuplicate` is sent. Do-not-contact and review
  still win first. Customer sessions stay 401. No worker wake. Nothing is
  mailed. Live Neon: unauth and `not-admin` 401; left-pad `contacted` 409
  verify; prettier stays `fixed`/`verified`; prettier vs left-pad still no
  match; leftover grants 0; leftover destinations 0; no open jobs;
  campaigns 0; watches 0; Cloudflare tunnel matched. Not a customer
  product and not a Pricing change.

- Disclosure Desk finding category: each case stores a closed category
  (sourcemap, environment, credential, source, and the other scanner
  families). New cases derive it from fingerprints. Operators can override.
  Reports and destination payloads include the label, never finding values.
  Customer sessions stay 401. No worker wake. Nothing is mailed. Live Neon:
  `052` applied; unauth and `not-admin` 401; owner desk 200; prettier
  verified case is `credential` from SEC-003 fingerprints; invalid
  category 400; leftover grants 0; leftover destinations 0; no open jobs;
  campaigns 0; watches 0; Cloudflare tunnel matched. Not a customer
  product and not a Pricing change.

- Disclosure Desk researcher roles: owner grants a GitHub login operator access
  to Artifact Leads (`GET`/`POST`/`DELETE /api/internal/operators`, cap 8,
  typed login confirm). Granted operators can run the desk. Queue counts and
  further grants stay owner-only (403). The owner login cannot be granted.
  Customer sessions stay 401. No worker wake. Nothing is mailed. Live Neon:
  `051` applied; unauth and `not-admin` 401; owner list empty; owner
  self-grant 400; missing confirm 400; grant `desk-researcher` 201; typed
  DELETE leftover grants 0; leftover destinations 0; no open jobs;
  campaigns 0; watches 0; Cloudflare tunnel matched. Not a customer
  product and not a Pricing change.

- Disclosure Desk duplicate matching: a new case also warns on the same GitHub
  owner (different repository) or the same vendor domain from a stored policy
  URL or security-contact email. Forge and registry hosts are not vendor
  domains. Do-not-contact entries whose contact is an email or host match that
  domain. Customer sessions stay 401. No worker wake and no migration. Nothing
  is mailed. Live Neon: unauth and `not-admin` 401; owner desk 200; prettier
  vs left-pad still no duplicate (prettier.io does not match stevemao);
  leftover destinations 0; no open jobs; campaigns 0; watches 0; Cloudflare
  tunnel matched. Not a customer product and not a Pricing change.

- Disclosure Desk destinations: owner saves one HTTPS webhook and one Jira
  Cloud project (`GET`/`POST`/`DELETE /api/internal/disclosure/destinations`).
  Secrets are encrypted and never returned. A test never invents an incident
  or creates a Jira issue. Filing a verified case
  (`POST /api/internal/prospects/:id/disclosure/notify`) posts a redacted
  report after typed coordinate confirm. Unverified cases stay 409. Customer
  sessions stay 401. No worker wake. Nothing is mailed. Live Neon: `050`
  applied; unauth and `not-admin` 401; owner list empty; localhost webhook
  400; evil Jira host 400; leftover destinations 0; no open jobs;
  campaigns 0; watches 0; Cloudflare tunnel matched. Not a customer
  product and not a Pricing change.

- Disclosure Desk researcher workload: owner Artifact Leads shows case counts
  per assignee (`GET /api/internal/disclosure/workload`). States, pending
  review, and missed deadlines only. Minutes, last-active, ranking, and
  billing fields are omitted. Customer sessions stay 401. No worker wake
  and no migration. Nothing is mailed. Live Neon: unauth and `not-admin`
  401; owner GET 200 counted EmotiveImpact’s verified prettier case and
  one unassigned signal (left-pad deadline missed); no open jobs;
  campaigns 0; watches 0; Cloudflare tunnel matched. Not a customer
  product and not a Pricing change.

- Package Identity registry cache: public npm packuments, including 404s, are
  cached for one hour per process (cap 256). Private-registry tokens bypass
  the cache. Watch Check now, connect, protect, and import fetch the watched
  name fresh. Lookalike and new-dependency metadata checks use the cache.
  The hourly poller skips lookalike candidates checked within the last hour
  (eight per pass); never-checked names stay due. Watch Check now still
  re-checks immediately.   Tarball bytes stay uncached. No extra fetch on the
  identity risk GET. No worker wake and no migration. Live Neon gates on
  install `158159401`: unauth GET `/api/packages/1/identity` 401, owner and
  `not-admin` unknown package 404, watch list empty, namespaces 0, no open
  jobs; Cloudflare tunnel matched. No EmotiveImpact-owned npm pack to poll.
  Not a Pricing change.

- Package Identity risk score: trial and Team Watch shows a deterministic 0–100
  signal total on a protected npm name (`GET /api/packages/:id/identity` `risk`).
  The total decomposes into current snapshot facts, registered non-allowlisted
  lookalikes, and open burst / lookalike-version / new-dependency / unpublished
  alerts. Same facts always produce the same total. Solo and unpaid keep the
  identity snapshot and omit the score. Another tenant 404. Never a malware
  verdict. No extra registry fetch and no worker wake. Live Neon gates on
  install `158159401`: unauth GET `/api/packages/1/identity` 401, owner and
  `not-admin` unknown package 404, watch list empty so no score to compute,
  no new jobs; Cloudflare tunnel matched. No EmotiveImpact-owned npm pack to
  score. Not a Pricing change.

- Artifact Leads discovery campaigns: owner saves GitHub search queries
  (`GET`/`POST`/`PATCH`/`DELETE /api/internal/prospects/campaigns`). The
  hourly poller rotates one enabled campaign (three public repos) after
  customer work, or keeps the default search when none are saved. Cap 8.
  Typed query confirm on create/delete. Customer sessions stay 401.
  Saving a campaign does not enqueue work. No seeded companies. Live Neon:
  `049` applied; unauth and non-admin 401; missing confirm 400; save 201;
  typed DELETE left 0 campaigns; prospect count unchanged; Cloudflare
  tunnel matched. Not a customer product and not a Pricing change.

- Disclosure Desk expired-evidence sweep: hourly poller and owner desk
  reads zero expired attachment ciphertext and expired operator notes.
  Attachment rows stay append-only except that one post-expiry update.
  DELETE stays rejected. Download of an expired attachment is still 410.
  Customer sessions stay 401. Nothing is mailed. Live Neon: `048`
  applied; unauth and non-admin desk GET 401; owner GET 200 ran the
  sweep; nothing was expired so existing attachment ciphertext stayed;
  leftover `protected_namespaces` 0; Cloudflare tunnel matched. Not a
  customer product and not a Pricing change.

- Package Identity namespace watchlists: trial and Team install admins
  watch the npm scope that matches this GitHub login (`POST /api/namespaces`).
  Public registry search only (cap 20 names). First check is a baseline.
  A later new name writes `identity_namespace_new` without downloading a
  tarball or enqueueing `npm_scan`. One scope per install. Members may
  read and check. Solo 403. Unpaid 402. Typed scope confirm. Another
  tenant is 403 or empty. Never a malware verdict. Other registries stay
  out. Live on install `158159401`: unauth GET/POST 401, `@prettier` 403,
  missing confirm 400, then owned `@emotiveimpact` POST 201 queued a light
  `namespace_check` that finished with an empty baseline snapshot and no
  `identity_namespace_new` alert, no `npm_scan`, and no prettier/left-pad
  watches; typed DELETE left `protected_namespaces` 0; Cloudflare tunnel
  matched. Not a Pricing change.

- Package Identity human-reviewed evidence: trial and Team install admins
  assemble a frozen evidence pack for a protected npm name and may publish
  `/advisory/:token`. Members may read and download the JSON. The public page
  shows the package name, repository/homepage host, and registered lookalike
  names. Takedown JSON adds maintainer names, publisher/trusted-publisher,
  lookalike versions, and identity alert titles. Typed package-name confirm.
  Solo 403. Unpaid 402 to change; an already-published page still reads.
  Another tenant 404. The token is not the package id. Audit records the
  package name only. Never sent to npm or GitHub. Never a malware verdict.
  Never downloads a tarball. Live Neon gates on install `158159401`: unauth
  GET/POST 401, missing package 404, unknown `/advisory/:token` 404, watch list
  still empty, evidence packs 0; Cloudflare tunnel matched. No
  EmotiveImpact-owned npm pack exists to assemble on that install. Other
  registries stay out. Not a Pricing change.

- PagerDuty destination: trial and Team installs save one encrypted Events API
  routing key per install. Host is locked to `events.pagerduty.com`. The key is
  never returned. A delivery test POSTs `/v2/change/enqueue` and never creates
  an incident or Watch alert. Real alerts POST `/v2/enqueue` with
  `event_action: trigger`. Solo 403. Unpaid 402. Members 403. Another tenant
  403. Email still waits on Resend. Removing a destination after a delivery
  test keeps the delivery row and nulls the destination id. Live on install
  `158159401`: unauth 401, invalid key 400, save 201 without the key, dummy
  test 502 with `inventedIncident: false` and no Watch alert, typed-confirm
  delete 200, leftover destination 0; Cloudflare tunnel matched. The dummy
  key was deleted. Not a Pricing change.

- Release Ledger public verification page: an install admin publishes
  `/verify/:token` for a sealed revision. Visitors see digests, receipt status,
  and last delivery host match. Query strings, pack bytes, CI URLs, and signed
  URLs are omitted. Failed-policy is not clean. Solo may publish. Unpaid 402 to
  publish or unpublish; an already-published page still reads. Members 403.
  Another tenant 404. The token is not the revision id. Audit records the
  coordinate only. Public GET does not enqueue a delivery download. Unpublish
  404s; republish keeps the same path. Live on throwaway `phase1-fixture`
  (`c74219d2…`, failed-policy, host `github.com` matched): unauth publish 401,
  publish 201, public GET 200 with `passingReceipt: false`, no query string,
  no new `delivery_verify` job; Cloudflare tunnel matched. Not scheduled CDN,
  SBOM, or Sigstore. Not a Pricing change.

- Disclosure Desk internal workflow: vendor replies, encrypted expiring
  attachments (text/PDF/image only; archives rejected), assignment, review
  approval before `contacted`, service-level timestamps, and redacted
  JSON/HTML/PDF reports that omit operator notes and attachment bytes.
  Customer sessions stay 401. Nothing is mailed. Live on the public prettier
  case: vendor reply recorded, `vendor-note.txt` stored, `.tgz` and zip magic
  rejected, assigned to EmotiveImpact, review approved, JSON/HTML/PDF reports
  omitted notes and bytes, customer 401. Client projects, billing, and
  aggregate research stay out. Not a customer product and not a Pricing
  change.

- Package Identity batch import: `POST /api/protections/import` (cap 20) protects
  npm names this GitHub install owns. Registry metadata only — no tarball
  download and no `npm_scan` job. Unowned, missing, or invalid names are not
  added to the watch list. Already protected names stay as they are. Watch cap
  is 25. Solo allowed. Unpaid 402. Another tenant 403. Watch has a matte-black
  import list. Live on install `158159401`: `prettier` / `left-pad` /
  `nospoilers-import-missing-zzzz` / `NOT A NAME!!!` returned `not_owned` /
  `not_owned` / `not_found` / `invalid`, `queued: false`, no watches added, no
  `npm_scan` job; anonymous 401; Cloudflare tunnel matched. No EmotiveImpact-owned
  npm pack exists to prove `protected` on Neon. Other registries, takedown
  evidence, and a consumer advisory page stay out. Not a Pricing change.

- Disclosure Desk Phase 2 minus send: human-edited templates, preferred vendor
  channel, do-not-contact (create is research-only unless confirmed; `contacted`
  is always blocked), credit/CVE/outcome notes, and an internal
  `deadline_missed` reminder. Preview still shows recipients, subject, and body
  and never sends. Resend stays benched. Customer sessions stay 401. Live-saved
  `security_email` plus credit/CVE notes on the public prettier case, previewed
  the `researcher-note` template (`sent: false`), blocked prettier `contacted`
  with do-not-contact, and emitted `Disclosure deadline missed for
  stevemao/left-pad`. Not a customer product and not a Pricing change.

- Artifact Leads notifies the owner only after a Disclosure Desk case is
  verified and has critical fingerprints. Unverified scans and warn-only cases
  do not. One notification per case. Mark-read. Never mailed. Rule ids and
  fingerprints only. Live-emitted one row for the verified public prettier
  case (`SEC-003` only; no values). Not a Pricing change.

- Artifact Leads includes Disclosure Desk Phase 1: an owner-only case per public
  lead, verification checklist, duplicate warning (owner/repo, package, or
  fingerprint), encrypted expiring notes, stored (never fetched) security contact
  or https policy URL, draft preview, simulated acknowledgement, internal deadline
  flag, conversion attribution, and a fix-version rescan. Outreach `contacted`
  requires a verified case; `fixed` requires that rescan. No message is sent.
  Customer sessions stay 401. Live-opened a case on the public `prettier`
  npm artifact from `prettier/prettier`, verified it, previewed a draft that
  was not sent, recorded a simulated acknowledgement, and queued a
  `3.9.7` fix-version rescan. Not a customer product and not a Pricing change.

- Trial and Team installs get Release Ledger governance: approve a passing sealed
  revision to ship or reject it, place a legal hold that survives the list
  retention window, and export the ledger JSON. The admin who attached a delivery
  URL cannot approve that revision. Another admin must release a hold.
  Failed-policy, inconclusive, and digest-changed rows cannot be approved.
  Members may export. Solo 403. Unpaid 402. Query strings and pack bytes stay off
  the export. Not scheduled CDN, SBOM, or Sigstore. Not a Pricing change.

- Sealed release revisions store packed size and an inferred media type
  (`.tgz` / npm → `application/gzip`, zip-family → `application/zip`).
  Watch shows both. Canonical and attached delivery URLs inherit that type
  when none is sent. Delivery verify uses it for content-type drift.
  Older rows stay null (append-only). Live-sealed throwaway
  `phase1-fixture` as 401 bytes / `application/gzip` (`c74219d2…`,
  failed-policy, no digest rewrite). Not a Pricing change.

- `nospoilers verify` accepts `--url` so CI can stream-hash a delivery URL
  against a signed receipt without uploading the pack. Same expected hops and
  SSRF rules as Watch. Query strings are not printed. Bytes are not stored.
  A local file is still optional. Failed-policy and inconclusive stay not
  clean. Live-matched the throwaway `phase1-fixture` GitHub download
  (`c74219d2…`, hop `github.com` → asset CDN, `x-cache:hit`) and still exited
  1 because that pack is failed-policy. Not a Pricing change.

- On-demand delivery verify stores hop hosts, a short cache token (`cf:hit`,
  `x-cache:hit`, `no-store`, `aged`), and a host-derived region (`us-east-1`,
  `r2`, `github`). Raw cache headers are not stored. Live-recorded the
  throwaway `phase1-fixture` hop as `github.com` →
  `release-assets.githubusercontent.com`, `x-cache:hit`, region `github`,
  digest `c74219d2…`. This is not the hourly poller and not scheduled CDN
  verification. Not a Pricing change.

- On-demand delivery verify follows same-bucket S3 path-style ↔ virtual-hosted
  hops and same-account R2 path-style ↔ virtual-hosted hops after a second DNS
  check. Arbitrary hosts, other buckets, CloudFront, website, accelerate, and
  `r2.dev` still are not fetched. GitHub Release → asset CDN hops stay expected.
  This is not the hourly poller and not scheduled CDN verification. Not a Pricing
  change.

- Watch Setup status probes whether the vendored Action and workflow YAML exist on
  the default branch or `nospoilers/setup`, and whether a NoSpoilers check ran on
  the default SHA. Members may read it. Unpaid still allowed. It never invents an
  alert and cannot see or set branch protection. Live-probed
  `EmotiveImpact/nospoilers-throwaway`: Action on `nospoilers/setup`, workflow
  missing, no NoSpoilers check. Not a Pricing change.

- Public GitHub Release download URLs and public npm tarball URLs are attached
  when a hosted scan seals a revision. Private repos and private registries are
  not. Verify stays on-demand (not the hourly poller, not scheduled CDN).
  Not a Pricing change.

- Watch Releases can attach an HTTPS delivery URL to a sealed revision and verify it
  now. The worker stream-hashes the bytes against the stored SHA-256, then deletes
  the download. Mismatch, disappearance, unexpected cross-host redirect, and
  content-type change are Watch facts, not compromise claims. A GitHub Release
  download hop to `release-assets.githubusercontent.com` /
  `objects.githubusercontent.com` is followed after a second DNS check; other
  hosts are not. Live-matched the throwaway `phase1-fixture` `sourcemap.tgz`
  (`c74219d2…`) after one hop to `release-assets.githubusercontent.com`. Query
  strings stay off Watch, alerts, and audit. This is not the hourly poller and
  not scheduled CDN verification. Unpaid 402. Members 403. Another tenant 404.
  Not a Pricing change.

- When Contents write commits setup or remediation files but Pull requests write is
  missing, the 409 names the branch and committed paths instead of pretending nothing
  landed. Watch links that branch. The App still does not merge. Not a Pricing change.

- Setup and remediation PRs commit the vendored Action with Contents write and leave
  `.github/workflows/nospoilers.yml` as copy-paste. GitHub needs a Workflows permission
  to create Actions YAML; the App does not request it and Watch Test install never asks
  a customer to Accept it. Pull requests write is still required to open the PR. The App
  never merges. Not a Pricing change.

- Milestone 1 GitHub loop is proven on `EmotiveImpact/nospoilers-throwaway`: Contents
  write accepted on install `158159401` (this account only), `throwaway/` seeded
  (Actions YAML skipped — Workflows write is not requested), `phase1-fixture` Release
  attached `sourcemap.tgz`, `release.published` → `release_scan` done → Watch
  “Spoilers in … phase1-fixture” and a `failed-policy` receipt (MAP-001/002/003).
  Cheap `.env` / `.map` push also alerted. Administration is not granted. Stripe and
  Resend stay benched.

- Artifact Leads hourly poller, after customer work, checks up to eight known npm
  leads for a new latest and can run a three-repo GitHub discover when a discovery
  token is set. Both skip if customer jobs are queued/running or the prospect queue
  is already at three. Owner “Check npm versions” is the same feed. Metadata only.
  No seeded companies. Not a Pricing change.

- Artifact Leads inspect discovers public npm workspace members from a repository’s
  workspace config (`packages/*` or a literal path, cap 8) and queues those packs
  behind customer jobs. A completed prospect scan stores member names from the packed
  workspace (cap 40). Members are not auto-watched. Owner-only. Not a Pricing change.

- Watch records `package_publisher_changed` when a protected pack’s npm `_npmUser`
  name or trusted-publisher id changes. First snapshot and empty previous publisher
  are baseline. Email and OIDC config ids are not stored. Solo allowed. Unpaid skips.
  Not a malware verdict. Not a Pricing change.

- Trial and Team Package Identity alerts when a protected pack loses npm packument
  attestations, changes provenance `predicateType`, or changes registry signature keyids.
  First snapshot is baseline. The attestation URL is not fetched. Signature values are
  not stored or verified. This is not a Sigstore/attestation adapter. Solo 403. Unpaid
  402. Not a malware verdict. Not a Pricing change.

- Trial and Team Package Identity alerts when a protected pack’s npm `dist.unpackedSize`
  is twice as large, or at least 5 MiB larger, than the last identity snapshot. First
  snapshot and missing size are baseline. Metadata only; the tarball is not downloaded.
  This is not SIZE-003 (hosted receipt unpack). Solo 403. Unpaid 402. Not a malware
  verdict. Not a Pricing change.

- Watch records `package_unpublished` when a watched npm name 404s after we already
  recorded a version. No tarball download. A 5xx or network error is not an unpublish.
  Unpaid skips. Another tenant cannot see it. Not a malware verdict. Not a Pricing change.

- Trial and Team Package Identity alerts when a protected pack adds a dependency whose npm
  name was first published within 14 days. First snapshot is baseline. An old package newly
  added does not alert. Missing registry metadata is skipped. Metadata only; the added
  tarball is not downloaded. Solo 403. Unpaid 402. Not a malware verdict. Not a Pricing
  change.
- `migrate()` no longer recreates older, narrower `audit_events` action checks on every
  boot. Invite and GitHub-response audit rows no longer block a second migrate.

- Trial and Team Watch can invite a teammate by GitHub login. They get that role the next
  time they sign in, if GitHub already lists them on this App install. Typed confirm. Solo
  403. Unpaid 402. GitHub suspend does not block. Members cannot invite. Already a member is
  409. First-user-admin still wins if a member invite would leave zero admins. Does not send
  email (Resend is benched). Does not grant GitHub Administration. Not a Pricing change.

- Watch Scan API shows the current hosted origin (`APP_BASE_URL`) for repository variable
  `NOSPOILERS_API_URL`. Signed-in `/api/me` includes it; anonymous omits it. Loopback and HTTP
  are not reachable from GitHub-hosted runners. Not a Pricing change.
- Customer Setup PR vendors `.github/actions/nospoilers` and POSTs packed bytes to hosted
  `/api/v1/scan` instead of `uses:` on this private product repository. Missing origin/token is
  CLI exit 2. Failed-policy is 1. Inconclusive or HTTP error is 2. 409 copy-paste returns both
  files. This repo still dogfoods `uses: ./`. Not a Pricing change.
- Inconclusive encryption fixtures (`inconclusive.encrypted.zip`, `inconclusive.crx`,
  `inconclusive.encrypted.oci.tar`) are first-class Scan examples. CLI exit 2 is not a
  passing receipt. Product CI classifies `inconclusive.*` as exit 2. This repo’s GitHub
  Action is dogfooded: clean pack must pass, dirty pack must fail closed. Not a Pricing change.
- Connected the application runtime to Neon `NoSpoilers` / `production` / `neondb`.
- Documented access boundaries; customer sessions cannot read Artifact Leads.
- Allowed the Cloudflare tunnel host so GitHub can reach `/api/webhooks/github`.
- Verify GitHub App setup only links installs the signed-in user actually owns.
- Attach billing accounts to GitHub installation IDs; skip hosted work when coverage has ended.
- Retry failed jobs with backoff and requeue stale locks after a worker crash.
- Encrypt GitHub OAuth tokens at rest, set Secure cookies on https, and cap hosted scans per address.
- Publish Privacy, Terms, retention, disclosure, support, and refund pages.
- Refuse weak `SESSION_SECRET` / webhook secrets on Neon or https; add `/api/ready` and JSON logs.
- Watch public npm packages: scan `latest` on connect, then new versions, mutated tarballs, dist-tags, and prerelease-channel tarballs (`next`/`beta`/`canary`/`rc`/`alpha`/`preview`, cap three extras). Other dist-tag moves stay tag-only.
- GitHub Release `edited` / `prereleased` / `released` enqueue a pack scan only when assets change. `unpublished` / `deleted` alert without downloading.
- GitHub `repository.deleted` removes the Watch row and does not upsert it again. `renamed` updates name and URL in place with no extra job.
- Drop every NoSpoilers session and the stored GitHub OAuth token when GitHub sends `github_app_authorization` revoked. The installation stays. HMAC required. Sign-out deletes only the current session.
- Watch copy: after merging the setup PR, mark the NoSpoilers check required; the App does not set branch protection.
- Public `/docs` for Watch, packed scans, coverage, and what we never do. Stripe checkout and Electron installers are not claimed live.
- Rate-limit GitHub OAuth and owner discovery per address, with Retry-After. Hosted scan, latest-release, npm check, and website check share the scan budget. Receipt checks use a separate verify budget. GitHub webhooks are not limited.
- GitHub `installation_target` renamed updates the Watch account login in place. No job. HMAC required. Unpaid still updates.
- Scan page checks a signed receipt JSON without unpacking. Optional pack SHA-256 is hashed in the browser and not uploaded. Authentic failed-policy or inconclusive is not clean. Coverage ended still allows the check.
- Watch downloads the signed receipt JSON for a sealed release. Unpaid still allowed. Another tenant is 404.
- Watch Releases lists the linked receipt status (`passed`, `failed-policy`, `inconclusive`). Failed-policy and inconclusive are not clean and are not allowed to ship. Unpaid still allowed.
- Scan lists the iOS IPA fixture next to APK. Mach-O is not executed.
- Scan lists the OCI image fixture next to docker save. Layers are not executed.
- Scan lists CRX, XPI, wheel, JAR, nupkg, and gem fixtures next to VSIX. Payloads are not executed.
- Authored disposable `throwaway/` content for `EmotiveImpact/nospoilers-throwaway` (hostile pack, `.env` cheap-push path, release workflow). `npm run phase1:throwaway` seeds those files and attaches `sourcemap.tgz` using Contents write, not Administration. The live repo is still empty until that write is granted.
- Watch Test install reports Members read (collaborator alerts), optional Contents/Pull requests/Checks write, and whether Administration was granted (it should not be). If the App requested a permission this install has not accepted, Test install names it and links to GitHub’s Accept page. It does not ask for Administration. Missing optional grants do not fail the test and do not invent an incident.
- Scan lists WAR, snupkg, and XAPK fixtures. Nested APKs are not executed.
- Scan lists Python sdist (PKG-INFO layout) and Chrome extension ZIP (WebExtension layout, not a CRX header) fixtures. Python and extension workers are not executed.
- Scan lists the Android AAB fixture next to APK. BundleConfig layout. DEX is not executed.
- Watch Scan latest release queues a heavy job, unpacks that repo’s current GitHub Release pack (not the git tree), and is not the hourly poller. No release or no packed asset is an alert without a download. A packed asset writes a failed-policy receipt when spoilers are present and is not allowed to ship. Anonymous is 401, unknown repo 404, another tenant 403.
- GitHub `member` added, `fork`, and cheap `push` (`*.map` / `.env` only) enqueue light Watch jobs and the worker writes alerts. Other member actions and pushes without those paths do not. HMAC required. Unpaid still HTTP 200 with no job. The GitHub `public` event queues the same publicized job. `repository.privatized` updates the Watch row and does not enqueue. Real GitHub proof is still outstanding.
- Record per-file manifests, signed HMAC scan receipts, explicit inconclusive status, and Release Diff.
- SIZE-003: hosted scans flag a 2× or ≥5 MiB unpacked jump versus the previous receipt or approved baseline. First scans do not. Warn, allowlistable, Checks warning. Not a Pricing change.
- Flag nested packs, backup copies, database dumps, internal docs, and escaping symlinks.
- Unpack nested tgz/zip/asar for inspection (never execute) up to three levels.
- Load `.nospoilers.yml` / hosted allowlists (exact rule, expiry, reason) and approve a scan baseline.
- Open a reviewable setup PR for the packed-artifact GitHub Action (never merged). The generated
  workflow lists existing `package.tgz` and `dist/` packs, scans each, and fails closed if none exist.
  Hosted release scans post GitHub Checks with rule/path annotations when Checks write is granted.
- Watch private npm registries: encrypted per-install tokens, same-host HTTPS tarballs, SSRF blocked.
- Discover npm/pnpm/Yarn/Bun workspaces in packed artifacts (members listed, never executed, never auto-watched).
- Flag crash dumps and ELF cores as CRASH-001; extra debug symbols stay DBG-001.
- Hosted scan API: hashed per-install tokens, `POST /api/v1/scan`, signed receipt, bytes deleted.
- Release Ledger foundations: append-only revisions, channels, source revision, stored CI URL.
- Package Identity foundations: verified protect, maintainer snapshots, repo/homepage/shape alerts.
- Install health: GitHub suspend/unsuspend/permission/repo-change alerts; tenant job list on Watch.
- Extra inspect: cloud/service-account, PKCS12, build caches (CACHE-001), broader AI/MCP pack.
- Fair-use hosted unpacks: Solo 1 concurrent heavy job per install, Team/trial 3. Daily cap
  Solo 8 / Team and trial 24 heavy unpacks per UTC day. Watch warning and pause copy. Owner
  aggregate counts. Webhooks stay HTTP 200. Customer hosted APIs 429 + Retry-After. No
  scan-credit meter. Event-driven queue. Not advertised as a Pricing change.
- Watch one-click GitHub responses: make-private, delete latest Release pack assets, and
  disable a workflow that is not `.github/workflows/nospoilers.yml`. Install admin, typed
  confirm, unpaid 402, GitHub suspend 409, members 403. 409 until Administration (not
  granted). Contents write is not enough. Success is audit plus a Watch alert you confirmed,
  not a discovered incident.
- Owner queue health: `/api/internal/queue` returns customer vs prospect counts, stale locks, oldest wait, and daily unpack aggregates. No payloads, tenant names, or credential values. Artifact Leads shows the counts.
- Incident response: live GitHub permission test without inventing an incident; alert ack/assign/resolve/reopen; exposure duration; rotation checklist; append-only `alert_events`; tenant JSON export of that activity.
- Multiple GitHub organizations: Watch selects one install; list APIs filter by `installationId`; sibling unpaid or GitHub-suspended orgs do not lock a live one.
- Live permission test reports the last customer job (kind/status/time) and still never inserts an alert.
- Public status page at `/status` from `/api/health` (no tenant data, no connection string).
- Slack incoming webhooks on trial/Team installs: encrypted URL, event-driven alert POST, delivery test that never invents an incident.
- SIEM/custom HTTPS webhooks on trial/Team installs: encrypted URL, private/local/metadata/Slack hosts blocked, DNS-resolved SSRF check, event-driven JSON POST, delivery test that never invents an incident.
- 90-day Team timeline: Watch lists this install’s alerts, acknowledgement activity, and notification deliveries for 90 days. Solo 403, unpaid 402, other tenants empty. No invented rows.
- Team members and roles: first GitHub user on an install is admin; later users are members. Trial/Team can promote, demote, and remove. Solo 403. Unpaid 402. Last admin stays. GitHub suspend does not block. Members keep Watch, ack, and delivery tests. Admins save Slack/SIEM/Jira, registries, scan tokens, allowlists, baselines, and open setup/remediation PRs.
- Jira Cloud tickets on trial/Team installs: `*.atlassian.net` only, encrypted email+token, listed project key, event-driven issue create, delivery test that GETs myself+project and never creates a ticket or Watch alert.
- Team alert routing: min severity, repository, package, teammate assign, and destination. Destinations without a route still receive every alert. Routed tests never invent an incident.
- Team audit log: append-only admin writes, typed confirmation on destructive actions, and a titles-only export of alerts and notification deliveries. Trial/Team. Solo 403. Unpaid 402. Members may read/export. Never stores URLs, emails, tokens, or secret values.
- Package Identity Team signals: bounded lookalike names, dormant resurrection, and release burst/version jump on trial/Team installs. Metadata-only candidate checks. Typed allowlist. Not a malware verdict. No auto advisory/takedown.
- Configurable data retention: 90/180/365 days or keep while this install exists. Lists hide older rows at query time. Append-only evidence is not deleted. Typed confirmation. Solo allowed. Unpaid 402.
- Extra packed formats: VSIX, CRX, XPI, Chrome extension ZIP, Python wheels and sdists, JAR/WAR, NuGet nupkg/snupkg, and Ruby gems. ZIP/tar magic, not extension alone. Encrypted zip and CRX without a ZIP payload are inconclusive. Zip-slip names flag ARC-002 and are not unpacked for content. Not advertised as a Pricing change.
- Docker/OCI image layers: docker save and OCI layout sniff, layer tars and gzip blobs, overlay whiteouts not applied, encrypted layers inconclusive. Not advertised as a Pricing change.
- APK/AAB/IPA: ZIP magic, AndroidManifest/BundleConfig/Payload layout, DEX/Mach-O never executed, signatures not verified, FairPlay not decrypted. Not advertised as a Pricing change.
- Serverless deployment bundles: ZIP magic plus host.json / serverless.yml / .aws-sam / netlify/functions / .vercel/output layout, or `.lambda.zip` name. Handlers never executed. Encrypted zip inconclusive. Not advertised as a Pricing change.
- Production website crawls: HTTPS origin, same-origin JS/CSS/maps plus bounded probes for
  exposed files, credentials, and linked internal paths, SSRF blocked, never executed. SPA
  catch-all HTML is not a secret file. Event-driven enqueue. Not advertised as a Pricing change.
- Sentry/Bugsnag map custody: matching debug ID or release, private lookup, public map absent. Encrypted tokens never returned. Event-driven. Not advertised as a Pricing change. Bugsnag cannot look up a debug ID.
- Automatic remediation PRs: Watch opens a reviewable PR with ignore rules, empty `.nospoilers.yml` (no silent allowlist), bundler hints, a `package.json` `files` snippet, and packed-artifact CI if missing. Never merged. 409 copy-paste when Contents+PR write is missing. Customer ignore/policy/workflow files are not overwritten.
- DOC-001 expanded to architecture/design/rfc/spec/product/month1/feature-inventory/electron, `*.prd.md`, `docs/internal/`, and numbered ADRs.
- Proved the GitHub loop on `EmotiveImpact/nospoilers-throwaway`: webhook → job → Created public alert.
- Added the exhaustive NoSpoilers Ultimate expansion PRD and feature inventory.
- Added NoSpoilers module PRDs for Release Ledger and Package Identity, an internal Disclosure Desk
  PRD, and a standalone Employee Public Footprint PRD.
- Added a revenue and indicative valuation model.
- Register and prove the real GitHub App on a disposable repository.

## [0.1.0] — 2026-09-01

### Added

- Scanner for directories, npm tarballs, ZIP, and Electron asar.
- Source-map, embedded-source, environment, private-key, Git-history, source, and size rules.
- High-confidence token, credential-config, AI-context, internal-location, and debug detectors.
- CLI, JSON/SARIF, committed fixtures, and composite GitHub Action.
- Vite/React Scan, Watch, Pricing, trial, and ended-coverage screens.
- GitHub OAuth/install code, HMAC webhooks, Postgres jobs, release scanning, visibility poller.
- Internal Artifact Leads for public GitHub Release and npm artifacts.
- Scanner resource limits and metadata-only prospect retention.
- Future Electron installer isolation plan covering DMG, EXE/NSIS, AppImage, and MSI.

### Changed

- Replaced 500 ms empty-queue polling with immediate enqueue wake-up and recovery checks.
- Prioritized customer work over internal prospect scans.
- Added Log in and a product frame to the landing page.
- Moved the useful trial/ended mockups into live routes.
- Removed the rejected animated Scan border.
- Adopted the supplied prohibition-O wordmark and matte-black visual system.

### Security

- Public prospect downloads are restricted to HTTPS GitHub/npm hosts.
- Prospect bytes are deleted; source and credential values are not stored.
- Hard defaults: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB/file, 90 seconds.
- Webhook signatures and delivery idempotency are tested.

### Known limitations

- GitHub App OAuth/install/webhooks are live; throwaway private → public and fixture release
  scan are not proven.
- Stripe, production hosting, and email are not built.
- DMG/EXE/MSI/AppImage extraction is not supported.

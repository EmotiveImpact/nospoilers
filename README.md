# NoSpoilers

**No spoilers in production.**

Secret scanners read git. NoSpoilers reads the **packed artifact** — the npm tarball, zip, VSIX, wheel, JAR, gem, Docker/OCI image, APK/IPA, serverless zip, or Electron `app.asar` you are about to ship — and watches GitHub so a private repo going public does not go unnoticed.

That is the class of leak that shipped Claude Code’s `cli.js.map` on npm and source maps inside a public desktop installer. GitHub secret scanning does not catch packed maps. Making the git repo private does not catch an installer on a CDN.

Product decisions (pricing, queue, what to buy later) live in **[docs/PRODUCT.md](docs/PRODUCT.md)**.
Execution order is in **[docs/ROADMAP.md](docs/ROADMAP.md)**, completed work in
**[CHANGELOG.md](CHANGELOG.md)**, and the next-agent brief in
**[docs/HANDOFF.md](docs/HANDOFF.md)**.

The complete expansion PRD is
**[docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md](docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md)**.
The exhaustive feature ledger is
**[docs/expansion/FEATURE-INVENTORY.md](docs/expansion/FEATURE-INVENTORY.md)**, the value model is
**[docs/expansion/VALUE-MODEL.md](docs/expansion/VALUE-MODEL.md)**, and product/module PRDs are
indexed in **[docs/products/README.md](docs/products/README.md)**.

## Run locally

```bash
npm install
npm run fixtures
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:4347** (port **4347**). `GET /api/health` reports whether the process is on
Neon, generic Postgres, or PGlite and never includes the connection string. `GET /api/ready` pings
the database and returns 503 if it cannot.

- **Product** (`/`) — what you buy: GitHub coverage, pack scans, 14-day trial.
- **Watch** (`/watch`) — logged-in desk while trial or a paid plan is on. Without GitHub keys this opens the trial layout (`/watch?as=trial`). `/watch?as=ended` is the same desk after coverage stops. Connect a public npm package to scan the `latest` tarball automatically. Connect an HTTPS origin to crawl same-origin JS/CSS/maps and a bounded probe of exposed files, credentials, and internal paths. Admins can connect Sentry or Bugsnag map custody.
- **Scan** (`/scan`) — drop a tarball, zip, VSIX, wheel, JAR, gem, Docker/OCI image, APK/IPA, Lambda zip, or asar. Signed-out still scans. Logged in with unpaid coverage locks hosted unpack — that look is `/scan?as=ended`.
- **Pricing** (`/pricing`) — Solo $29 / Team $99.
- **Legal** — `/privacy`, `/terms`, `/retention`, `/disclosure`, `/support`, `/refunds`.

Two logged-in states: **trial desk** (bot is thinking) and **unpaid locked scan** (drop zone stays, we do not unpack).

### Internal Artifact Leads

The private company desk at `/internal/prospects` discovers real public GitHub Release packs and
root npm packages, queues them through the scanner, and keeps only finding metadata. It never keeps
source or secret values and never contacts maintainers automatically.

Set a long random `ADMIN_TOKEN` in `.env`, then enter it in the page. A real GitHub session whose
login matches `ADMIN_GITHUB_LOGIN` can also open it. `GITHUB_DISCOVERY_TOKEN` is optional but raises
GitHub's public API limit from 60 to 5,000 requests per hour.

The desk deliberately supports only public `.tgz`, `.tar.gz`, `.zip`, and `.asar` artifacts from
GitHub and npm. Use findings for private, responsible disclosure—never public prospect lists.
Prospect scans run one at a time and customer release jobs stay ahead of them in the heavy queue.

Default database is embedded Postgres (`pglite://./data/nospoilers`). Optional Docker Postgres:

PGlite is PostgreSQL compiled to run inside this Node process; its files live under `data/`. It is
for local development, not the production database. Production uses normal Postgres (Neon is the
current managed option) for users, sessions, GitHub installations, jobs, alerts, prospects, and
billing metadata. Packed artifacts are never stored there.

Queue processing is event-driven: webhook, dashboard, and internal discovery routes wake the worker
as soon as they insert a job. On Neon, a dedicated `LISTEN nospoilers_jobs` connection reconnects
if the compute drops the idle socket; that reconnect is not empty-queue polling.
`WORKER_INTERVAL_MS` is only a 15-minute recovery check for work left
behind by a crash; it is not the normal pickup path. Failed jobs retry with backoff (default 5
attempts). Stale running locks are requeued. `POLL_INTERVAL_MS` is different—the hourly GitHub
visibility backstop that catches a missed webhook.

```bash
docker compose up -d
# DATABASE_URL=postgres://nospoilers:nospoilers@127.0.0.1:5433/nospoilers
```

CLI and Action still work without the GitHub App:

```bash
npx tsx src/cli.ts scan ./package.tgz
npx tsx src/cli.ts verify ./package.tgz --receipt ./receipt.json
```

`scan` exits 0 on pass, 1 on failed policy, and 2 when the result is inconclusive (limits,
malformed archive, timeout). Inconclusive is never a clean bill of health. `verify` re-hashes the
file and checks the HMAC receipt. Set `RECEIPT_SECRET` (or `SESSION_SECRET`) to the same value the
host used. The development signer is HMAC `dev-hmac` behind an adapter; production signing should
move this signer to KMS. Hosted scans may send `--channel`, `--source-revision`, and `--ci-run`
(or `NOSPOILERS_CHANNEL` / `NOSPOILERS_SOURCE_REVISION` / `NOSPOILERS_CI_RUN`). CI run URLs are
stored and never fetched.

## Prove the loop on a throwaway repo

1. Create a **private** GitHub repo you do not care about (example: `nospoilers-throwaway`).
2. Create the GitHub App (checklist below) and fill `.env`. Restart `npm run dev`.
3. In the UI, **Sign in with GitHub**, then **Install on GitHub**. Choose only that throwaway repo.
4. In GitHub: Settings → General → Danger zone → **Change visibility** → Public.
5. Within about a minute the Watch page should show **Went public**.
6. Seed the disposable git files and publish the hostile pack: `npm run phase1:throwaway`.
   After a Cloud Agent tunnel change, `APP_BASE_URL=https://<tunnel> npm run phase1:visibility`
   points the App webhook. Publicize is private → public on this throwaway
   (`EmotiveImpact/nospoilers-throwaway`). Leave `npm run dev` running. Optional
   `GITHUB_PROOF_TOKEN` on that disposable repo only. Do not invent `-vis`.
   Do not grant the App Administration.
   That writes `throwaway/` onto `EmotiveImpact/nospoilers-throwaway` and attaches
   `fixtures/sourcemap.tgz` as GitHub Release `phase1-fixture`. Or create that Release by
   hand. Publishing with no pack yet, then uploading the asset, still scans (`release.edited`).
   Watch **Scan latest release** unpacks that pack, not the git tree.

The GitHub App install on `EmotiveImpact` now has **Contents: write**. That can create
commits and Release assets on repos this install covers. `npm run phase1:throwaway` is
idempotent and skips `.github/workflows/` (that needs a Workflows permission we do not
request). Optional **Pull requests write** and **Checks write** open setup/remediation PRs
and hosted Checks. After Pull requests write is requested on the App and accepted,
`npm run phase1:setup-pr` opens the reviewable setup PR on this throwaway and never
merges it. Members read is still requested on the App and not accepted on the
install.

**Administration** is a different GitHub permission. It is repo-admin: make a repository
private, delete Release assets, disable workflows, change settings. Watch can confirm those
three actions; they return 409 GitHub UI steps until Administration is granted. Do not grant
it to finish Phase 1. Contents write is not enough for those actions.

Or set `GITHUB_PROOF_TOKEN` to a **fine-grained** PAT for **only**
`EmotiveImpact/nospoilers-throwaway` with Contents: write. Do not use a classic `repo` PAT.
Do not publicize a product repository. Stripe and Resend stay dark without keys.

If GitHub cannot reach your laptop, start a webhook relay (leave `npm run dev` running):

```bash
npx smee-client --url https://smee.io/your-channel --target http://127.0.0.1:4347/api/webhooks/github
```

Put that smee URL in the GitHub App **Webhook URL**. Or:

```bash
cloudflared tunnel --url http://127.0.0.1:4347
```

Use `https://<tunnel>/api/webhooks/github` as the Webhook URL.

## Create the GitHub App (you click this; an agent cannot)

GitHub → your profile → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.

| Field | Value |
| --- | --- |
| GitHub App name | `NoSpoilers` (or `NoSpoilers-dev` if the name is taken) |
| Homepage URL | `http://127.0.0.1:4347` |
| Callback URL | `http://127.0.0.1:4347/api/auth/github/callback` |
| Setup URL | `http://127.0.0.1:4347/api/github/setup` |
| Redirect on update | checked |
| Webhook URL | `http://127.0.0.1:4347/api/webhooks/github` **or** your smee/cloudflared URL |
| Webhook secret | a long random string; same value as `GITHUB_WEBHOOK_SECRET` |
| Expire user authorization tokens | optional; leave off for local |

**Permissions** (Repository):

- **Metadata** — Read-only (required)
- **Contents** — Read-only to download release assets. Optional **Read and write** to seed the
  throwaway fixture, upload Release packs, and commit the vendored setup/remediation
  Action (non-workflow files). GitHub Actions workflow YAML stays copy-paste;
  Workflows write is not requested. A setup or remediation PR still needs
  **Pull requests** write.
- **Pull requests** — Optional **Read and write** to open those PRs. The App **never merges** them
- **Checks** — Optional **Read and write** to report hosted release-scan results on the tag SHA
- **Members** — Read-only (collaborator added)

Do **not** grant **Administration**. That permission is GitHub repo-admin (visibility,
collaborators, delete assets, disable workflows, change settings). It is not required for
Watch, Release scans, or setup PRs. Branch protection / required checks stay a maintainer
action after they merge the setup PR.

**Subscribe to events:** `Meta`, `Installation`, `Installation repositories`, `Installation target`, `Repository`, `Public`, `Push`, `Release`, `Member`, `Fork`, `GitHub App authorization`.

Create the app. Then:

1. Copy **App ID** → `GITHUB_APP_ID`
2. **Generate a private key** — paste the PEM into `GITHUB_APP_PRIVATE_KEY` (you can keep `\n` as the two-character sequence in `.env`)
3. Copy **Client ID** → `GITHUB_CLIENT_ID`
4. Generate a **client secret** → `GITHUB_CLIENT_SECRET`
5. Public link slug (the name in `github.com/apps/…`) → `GITHUB_APP_SLUG`
6. Webhook secret → `GITHUB_WEBHOOK_SECRET` (at least 32 random characters)
7. `SESSION_SECRET` → a **different** long random string (at least 32 characters). Neon and https
   origins refuse to boot if this is missing, short, a known default, or equal to the webhook secret.
8. Optional Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and Solo/Team monthly+yearly
   price IDs. Checkout and `/api/webhooks/stripe` stay 503 until all six are set. Point Stripe at
   `/api/webhooks/stripe`. Do not commit live secrets.

Where to install: **Install App** on your user or org, only the throwaway repo until you trust it.

## Scan locally (CLI)

```bash
npx tsx src/cli.ts scan ./package.tgz
npx tsx src/cli.ts scan ./release/app.asar --policy .nospoilers.yml
npx tsx src/cli.ts scan ./dist --no-policy
```

Exit codes: `0` clean (warnings only unless `--strict`), `1` critical spoilers, `2` could not read the path.

If `.nospoilers.yml` exists in the current directory, `scan` loads it unless `--no-policy` is set.
Allow entries must name one rule, a reason (≥8 characters), and a future expiry (≤730 days).
They never suppress a different rule.

```yaml
version: 1
strict: false
allow:
  - rule: SRC-001
    path: "**/*.d.ts"
    reason: Published TypeScript types
    expires: 2027-12-01
```

## GitHub Action

This repository dogfoods the local Action (`uses: ./` in `.github/workflows/ci.yml`). Customer
repositories cannot `uses:` this private repo. Watch Setup PR vendors
`.github/actions/nospoilers`, which POSTs packed bytes to hosted `/api/v1/scan`:

```yaml
- uses: ./.github/actions/nospoilers
  with:
    path: ./package.tgz
    api-url: ${{ vars.NOSPOILERS_API_URL }}
    api-token: ${{ secrets.NOSPOILERS_API_TOKEN }}
```

Mint the token on Watch. Set `NOSPOILERS_API_URL` to an HTTPS origin GitHub-hosted runners can
reach. Exit codes: `0` passed, `1` failed-policy, `2` error or inconclusive. The Action does not
execute the pack.

On **push**, the hosted app only cheap-checks paths like `*.map` and `.env`. It does **not** unpack the git tree. Full unpack is for **release assets** (and the dashboard **Scan latest release** button).

## What it flags

| Rule | Severity | Meaning |
| --- | --- | --- |
| MAP-001 | critical | A source map file is in the pack |
| MAP-002 | critical | That map embeds original source (`sourcesContent`) |
| MAP-003 | critical | A JS/CSS file has a `sourceMappingURL` comment |
| SEC-001 | critical | `.env` / `.env.*` |
| SEC-002 | critical | Private key / PEM |
| SEC-003 | critical | High-confidence GitHub, npm, Stripe, OpenAI, Anthropic, Slack, GitLab, AWS, or Google credential |
| SEC-004 | warn | Credential configuration such as `.npmrc`, `.pypirc`, cloud credentials, Docker or Kubernetes config |
| AI-001 | warn | Agent instructions, prompts, memory, transcripts, or MCP configuration |
| NET-001 | warn | Private-network URL, localhost endpoint, or absolute developer-machine path |
| DBG-001 | warn | Debug symbols, compiler state, build statistics, or debug logs |
| GIT-001 | critical | `.git` packed into the artifact |
| SRC-001 | warn | `.ts` / `.tsx` / `.jsx` source (not `.d.ts`) |
| SIZE-001 | warn | A packed file is 10 MB or larger |
| SIZE-002 | warn | Unpacked payload is 50 MB or larger |
| SIZE-003 | warn | Unpacked payload is 2× or at least 5 MiB larger than the previous or approved scan |
| ARC-001 | warn | Nested `.tgz` / `.zip` / `.asar` inside the pack (unpacked for inspection, not executed) |
| BAK-001 | warn | Backup copy (`*.bak`, `*~`, `.backup`) |
| DB-001 | critical | Database dump packed into the artifact |
| DOC-001 | warn | Internal docs: ROADMAP/HANDOFF/TODO/PRD, architecture/design/rfc/spec/product, `docs/internal/`, numbered ADRs |
| LNK-001 | critical | Absolute or `..` symlink; the link is not followed |

Credential values are never included in reports. Default safety limits are 80 MiB input, 500 MiB
unpacked, 25,000 files, 25 MiB per file, and 90 seconds. Exceeding a hard limit stops the scan
rather than partially declaring an artifact clean.

`.dmg`, `.exe`, and `.AppImage` installer extraction is not supported yet. It is deliberately kept
outside this worker until it can run as an isolated, ephemeral job with its own memory, disk, CPU,
network, and timeout limits. See [docs/ELECTRON.md](docs/ELECTRON.md).

## Hidden maps for crash reporting

Generate maps, upload them to Sentry/Bugsnag with `hidden-source-map`, then delete them from the pack. The map can exist in CI. It must not exist in the file customers download.

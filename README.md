# NoSpoilers

**No spoilers in production.**

Secret scanners read git. NoSpoilers reads the **packed artifact** — the npm tarball, zip, or Electron `app.asar` you are about to ship — and watches GitHub so a private repo going public does not go unnoticed.

That is the class of leak that shipped Claude Code’s `cli.js.map` on npm and source maps inside a public desktop installer. GitHub secret scanning does not catch packed maps. Making the git repo private does not catch an installer on a CDN.

Product decisions (pricing, queue, what to buy later) live in **[docs/PRODUCT.md](docs/PRODUCT.md)**.
Roadmap, current handoff, and changelog: **[docs/ROADMAP.md](docs/ROADMAP.md)**, **[docs/HANDOFF.md](docs/HANDOFF.md)**, **[CHANGELOG.md](CHANGELOG.md)**.

## Run locally

```bash
npm install
npm run fixtures
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:4347** (port **4347**). `GET /api/health` reports whether the process is on Neon or PGlite.

- **Product** (`/`) — what you buy: GitHub coverage, pack scans, 14-day trial.
- **Watch** (`/watch`) — logged-in desk while trial or a paid plan is on. Without GitHub keys this opens the trial layout (`/watch?as=trial`). `/watch?as=ended` is the same desk after coverage stops.
- **Scan** (`/scan`) — drop a tarball, zip, or asar. Signed-out still scans. Logged in with unpaid coverage locks hosted unpack — that look is `/scan?as=ended`.
- **Pricing** (`/pricing`) — Solo $29 / Team $99.

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

### Database

The hosted app uses **Neon** (project **NoSpoilers**, branch **production**, database **neondb**).
Set `DATABASE_URL` to that connection string. A Cursor runtime secret named `DATABASE_URL` overrides
`.env`. Do **not** copy local PGlite files from `data/` into Neon. Neon Auth stays off; GitHub App
OAuth is the login.

PGlite (`pglite://./data/nospoilers`) is a laptop fallback when Neon is not configured. Optional
Docker Postgres:

```bash
docker compose up -d
# DATABASE_URL=postgres://nospoilers:nospoilers@127.0.0.1:5433/nospoilers
```

Queue processing is event-driven: webhook, dashboard, and internal discovery routes wake the worker
as soon as they insert a job. `WORKER_INTERVAL_MS` is only a 15-minute recovery check for work left
behind by a crash; it is not the normal pickup path. Do not poll the empty queue every 500ms.
`POLL_INTERVAL_MS` is different—the hourly GitHub visibility backstop that catches a missed webhook.

CLI and Action still work without the GitHub App:

```bash
npx tsx src/cli.ts scan ./package.tgz
```

## Prove the loop on a throwaway repo

1. Create a **private** GitHub repo you do not care about (example: `nospoilers-throwaway`).
2. Create the GitHub App (checklist below) and fill `.env`. Restart `npm run dev`.
3. In the UI, **Sign in with GitHub**, then **Install on GitHub**. Choose only that throwaway repo.
4. In GitHub: Settings → General → Danger zone → **Change visibility** → Public.
5. Within about a minute the Watch page should show **Went public**.
6. (Optional) Create a Release, attach `fixtures/sourcemap.tgz`, wait for **Spoilers in …** or click **Scan latest release**.

`127.0.0.1` is **this machine**. GitHub's servers cannot call it. Your browser can use it only if you are sitting on that same machine.

- **Laptop, browser on that laptop:** Homepage / Callback / Setup can be `http://127.0.0.1:4347…`. Webhooks still need a public URL.
- **Cloud Agent or any remote VM:** Homepage, Callback, Setup, **and** Webhook must be a public HTTPS origin. Set `APP_BASE_URL` to that origin and sign in from it, not from `127.0.0.1`.

Leave `npm run dev` running, then:

```bash
cloudflared tunnel --url http://127.0.0.1:4347
```

Quick tunnels print a host like `https://random-words.trycloudflare.com`. That host **changes every restart**. Put it in the GitHub App and in `APP_BASE_URL`, then restart `npm run dev`.

Webhook-only relay (does **not** fix OAuth on a remote VM):

```bash
npx smee-client --url https://smee.io/your-channel --target http://127.0.0.1:4347/api/webhooks/github
```

## Create the GitHub App (you click this; an agent cannot)

GitHub → your profile → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.

Replace `ORIGIN` with `http://127.0.0.1:4347` on a laptop, or with the current `https://….trycloudflare.com` on this Cloud Agent.

| Field | Value |
| --- | --- |
| GitHub App name | `NoSpoilers` (or `NoSpoilers-dev` if the name is taken) |
| Homepage URL | `ORIGIN` |
| Callback URL | `ORIGIN/api/auth/github/callback` |
| Setup URL | `ORIGIN/api/github/setup` |
| Redirect on update | checked |
| Webhook URL | `ORIGIN/api/webhooks/github` |
| Webhook secret | a long random string; same value as `GITHUB_WEBHOOK_SECRET` |
| Expire user authorization tokens | optional; leave off for local |

**Permissions** (Repository):

- **Metadata** — Read-only (required)
- **Contents** — Read-only (release assets)
- **Members** — Read-only (collaborator added)

**Subscribe to events:** `Meta`, `Installation`, `Installation repositories`, `Repository`, `Public`, `Push`, `Release`, `Member`, `Fork`.

Create the app. Then:

1. Copy **App ID** → `GITHUB_APP_ID`
2. **Generate a private key** — paste the PEM into `GITHUB_APP_PRIVATE_KEY` (you can keep `\n` as the two-character sequence in `.env`)
3. Copy **Client ID** → `GITHUB_CLIENT_ID`
4. Generate a **client secret** → `GITHUB_CLIENT_SECRET`
5. Public link slug (the name in `github.com/apps/…`) → `GITHUB_APP_SLUG`
6. Webhook secret → `GITHUB_WEBHOOK_SECRET`

Where to install: **Install App** on your user or org, only the throwaway repo until you trust it.

## Scan locally (CLI)

```bash
npx tsx src/cli.ts scan ./package.tgz
npx tsx src/cli.ts scan ./release/app.asar
npx tsx src/cli.ts scan ./dist
```

Exit codes: `0` clean (warnings only unless `--strict`), `1` critical spoilers, `2` could not read the path.

## GitHub Action

```yaml
- uses: EmotiveImpact/nospoilers@main
  with:
    path: ./package.tgz
    sarif: nospoilers.sarif
```

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

Credential values are never included in reports. Default safety limits are 80 MiB input, 500 MiB
unpacked, 25,000 files, 25 MiB per file, and 90 seconds. Exceeding a hard limit stops the scan
rather than partially declaring an artifact clean.

`.dmg`, `.exe`, and `.AppImage` installer extraction is not supported yet. It is deliberately kept
outside this worker until it can run as an isolated, ephemeral job with its own memory, disk, CPU,
network, and timeout limits. See [docs/ELECTRON.md](docs/ELECTRON.md).

## Hidden maps for crash reporting

Generate maps, upload them to Sentry/Bugsnag with `hidden-source-map`, then delete them from the pack. The map can exist in CI. It must not exist in the file customers download.

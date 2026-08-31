# NoSpoilers

**No spoilers in production.**

Secret scanners read git. NoSpoilers reads the **packed artifact** — the npm tarball, zip, or Electron `app.asar` you are about to ship — and watches GitHub so a private repo going public does not go unnoticed.

That is the class of leak that shipped Claude Code’s `cli.js.map` on npm and source maps inside a public desktop installer. GitHub secret scanning does not catch packed maps. Making the git repo private does not catch an installer on a CDN.

Product decisions (pricing, queue, what to buy later) live in **[docs/PRODUCT.md](docs/PRODUCT.md)**.

## Run locally

```bash
npm install
npm run fixtures
cp .env.example .env
npm run dev
```

Open **http://127.0.0.1:4347** (port **4347**).

- **Product** (`/`) — what you buy: GitHub coverage, pack scans, 14-day trial.
- **Watch** (`/watch`) — sign in, install the app, repos and alerts.
- **Scan** (`/scan`) — drop a tarball, zip, or asar. Fixtures: `clean.tgz` should pass; `sourcemap.*` and `dotenv.tgz` should fail.
- **Pricing** (`/pricing`) — Solo $29 / Team $99.
- **Mockups** (`/mockups`) — static screens for trial desk and locked hosted scan.

Default database is embedded Postgres (`pglite://./data/nospoilers`). Optional Docker Postgres:

```bash
docker compose up -d
# DATABASE_URL=postgres://nospoilers:nospoilers@127.0.0.1:5433/nospoilers
```

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
| GIT-001 | critical | `.git` packed into the artifact |
| SRC-001 | warn | `.ts` / `.tsx` / `.jsx` source (not `.d.ts`) |
| SIZE-001 | warn | A packed file is 10 MB or larger |
| SIZE-002 | warn | Unpacked payload is 50 MB or larger |

## Hidden maps for crash reporting

Generate maps, upload them to Sentry/Bugsnag with `hidden-source-map`, then delete them from the pack. The map can exist in CI. It must not exist in the file customers download.

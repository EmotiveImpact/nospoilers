# NoSpoilers

**No spoilers in production.**

Secret scanners read git. NoSpoilers reads the **packed artifact** — the npm tarball, zip, or Electron `app.asar` you are about to ship. If a source map, original source, `.env`, private key, or `.git` directory is inside, the command exits `1` and CI fails.

That is the class of leak that shipped Claude Code’s `cli.js.map` on npm and source maps inside a public desktop installer. GitHub secret scanning does not catch it. Making the GitHub repo private does not catch it.

## Scan locally

```bash
npm install
npx tsx src/cli.ts scan ./package.tgz
npx tsx src/cli.ts scan ./release/app.asar
npx tsx src/cli.ts scan ./dist
```

Exit codes: `0` clean (warnings only unless `--strict`), `1` critical spoilers, `2` could not read the path.

```bash
npx tsx src/cli.ts scan ./package.tgz --json
npx tsx src/cli.ts scan ./dist --strict
npx tsx src/cli.ts scan ./package.tgz --sarif nospoilers.sarif
```

## GitHub Action

```yaml
- uses: EmotiveImpact/nospoilers@main
  with:
    path: ./package.tgz
    sarif: nospoilers.sarif
```

The action writes a SARIF 2.1 file you can upload with `github/codeql-action/upload-sarif` if code scanning is on. `path` is a directory, `.tgz` / `.tar.gz`, `.zip`, or `.asar`. Set `strict: true` to fail on packed TypeScript/JSX source and size spikes as well.

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

It does **not** watch whether a GitHub repository flipped from private to public. Use GitGlow or GitHub org settings for that.

## Local UI

```bash
npm install
npm run fixtures
npm run dev
```

Open the printed URL (port **4347**). Drop a real pack, or scan the fixtures (`clean.tgz` should pass; `sourcemap.tgz` / `sourcemap.asar` / `sourcemap.zip` / `dotenv.tgz` should fail).

## Hidden maps for crash reporting

Generate maps, upload them to Sentry/Bugsnag with `hidden-source-map`, then delete them from the pack. The map can exist in CI. It must not exist in the file customers download.

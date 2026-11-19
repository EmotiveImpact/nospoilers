# AI release review and fix pull requests

Added on 31 October 2026 (migration `125_ai_review_fix_prs`). Off by default: nothing is sent to a model provider until the operator sets the environment described below.

## What it does

1. **Attacker-view signals.** Every scan now collects short identifiers from shipped JavaScript and from source rebuilt out of public source maps: route paths that read as admin, internal, debug or API surface; feature-flag keys; staging, internal or private-network hostnames; and environment variable names. File contents, code and secret values are never collected. Anything token-shaped is dropped. Each list is capped at 60 entries. The rebuilt source itself is still never stored.
2. **AI release review.** After a GitHub release scan or a website scan saves its alert, a light `ai_release_review` job runs. A frontier reasoning model double-checks each finding (confirmed, likely false positive, needs a person), explains it in plain English, suggests one fix, rates impact, and points out the exposed surface an attacker would care about. For more than 12 findings, an optional cheaper triage model does a first pass in batches of 50.
3. **Fix pull requests.** On a GitHub release alert, an admin can open a fix PR. The edits are deterministic and rule-based; no model writes code. Covered today:
   - Public source maps (MAP-001/002/003 and anything rebuilt from a map): `!**/*.map` in `package.json` `files`, or `**/*.map` in `.npmignore`; Vite `sourcemap: true` becomes `'hidden'`, Next.js `productionBrowserSourceMaps: true` becomes `false`, webpack `devtool: 'source-map'` becomes `'hidden-source-map'`. Only exact matches are edited.
   - Shipped environment files (SEC-001): packaging exclusion, `.env` rules in `.gitignore`, and deletion of a committed `.env` (never `.env.example`). The PR says to rotate every value.
   - Loose files (backups, dumps, crash files, caches, raw TypeScript, internal docs, agent context, keys, credential files, `.git`): exact-path packaging exclusions.
   - When `.npmignore` does not exist yet, it is created with the existing `.gitignore` rules copied in, because npm stops reading `.gitignore` once `.npmignore` exists.
4. **Verified closed.** When the next release of the same repository is scanned and none of the targeted findings come back, the fix is marked `verified_closed`, the alert is resolved by `nospoilers` with the release tag in the note, and an alert event is written. An inconclusive scan proves nothing and is ignored. Merging the PR alone never closes the alert.

## Trust boundaries

- The rules scanner stays the trusted core. The AI review never changes a severity, scan status, receipt, gate decision or alert state.
- Model output is validated: finding IDs must exist, surface notes must quote values the scanner actually saw, text is bounded and rendered as plain text, and any finding the model skipped is shown as unreviewed (never as clean).
- Inputs are framed as untrusted data and the system prompt tells the model never to follow instructions inside them.
- The fix PR body and changes are fixed text and exact edits, never model output. NoSpoilers never merges.
- What leaves NoSpoilers: finding rule, severity, path, title and detail; the source label (repository and tag, or website host); and the attacker-view identifiers. Not file contents, not secret values.

## Provider policy (enforced in code)

`src/server/ai-review/providers.ts` refuses to start when any of these fail:

- `NOSPOILERS_AI_REVIEW=on` is required. A stray `ANTHROPIC_API_KEY` enables nothing.
- Each tier must declare `REGION=us` or `eu` and `ZERO_DATA_RETENTION=attested`. Only set `attested` once the provider contract is actually in place.
- China-hosted model APIs are refused (DeepSeek, Zhipu/Z.ai, Moonshot, Alibaba DashScope, Volcengine, MiniMax, Baichuan, StepFun, 01.AI, Baidu, Tencent and any `.cn` host).
- Model names that read as uncensored, abliterated or jailbreak-tuned are refused.
- HTTPS only, except loopback for a self-hosted model.

## Configuration

| Variable | Meaning |
|---|---|
| `NOSPOILERS_AI_REVIEW` | `on` to enable. Anything else leaves the feature off. |
| `NOSPOILERS_AI_REASONING_PROVIDER` | `anthropic` (default) or `openai-compatible`. |
| `NOSPOILERS_AI_REASONING_MODEL` | Defaults to `claude-opus-5-5`. |
| `NOSPOILERS_AI_REASONING_API_KEY` | Falls back to `ANTHROPIC_API_KEY` for the Anthropic provider. |
| `NOSPOILERS_AI_REASONING_REGION` | `us` or `eu`. |
| `NOSPOILERS_AI_REASONING_ZERO_DATA_RETENTION` | `attested`. |
| `NOSPOILERS_AI_REASONING_EFFORT` | Optional Claude effort, default `high`. |
| `NOSPOILERS_AI_TRIAGE_PROVIDER` | Optional, `openai-compatible`, for an open model on Mistral (EU), a US-hosted platform or self-hosted vLLM. |
| `NOSPOILERS_AI_TRIAGE_BASE_URL`, `_MODEL`, `_API_KEY`, `_REGION`, `_ZERO_DATA_RETENTION` | As above for the triage tier. |
| `NOSPOILERS_AI_DAILY_REVIEWS` | Reviews per installation per UTC day, default 40. |

The worker reads these at start-up (`createRuntime`). The web app only reads stored results, so Vercel needs no model keys.

## GitHub App permissions

Fix PRs use the same permissions as the existing remediation PR: Contents read and write, Pull requests read and write. No Administration, no Workflows write.

## Not done yet

- No live provider has been called from this code; tests use fake providers. Activation needs the owner to sign the zero-retention terms, set the variables on Railway and watch the first reviews.
- Fix PRs cover repository-backed GitHub release alerts. Website and npm-watch alerts get the AI review but no PR, because there is no repository link.
- Monorepos: exclusions are written at the repository root. A package in a subfolder needs the same lines in its own `package.json` or `.npmignore`; the PR says so through `npm pack --dry-run`.
- Verification closes only alerts that have a fix PR. Extending "verified closed" to every alert is a small follow-up.

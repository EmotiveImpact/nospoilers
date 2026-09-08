# Release assurance handoff

8 September 2026. Branch: `codex/release-assurance-spine-v1`.
Base main commit: `675916b4b9b843bff2cb0651ec13034f2f62775d`.

## Read this first

Actual code, not just a proposal, has been added. This is a bounded first increment of the requested Release Assurance vision. Do not claim the entire previously discussed platform is finished. Autonomous AI investigation, new enforcement adoption, comprehensive web-asset parity and customer-specific baseline learning are still implementation work, not merely missing API keys.

The newer `GATE-B-FINAL-EVIDENCE-MATRIX.md` records Gate B complete. Preserve that baseline. This change neither reopens those historical acceptance rows by assertion nor proves new changes satisfy them. Gate A deployment/isolation and the other operational launch approvals remain separate.

## What changed

`src/assurance/` adds a typed interpretation of existing signed evidence: receipt/identity validation, explicit ready/review/blocked/unknown states, separate published-delivery freshness, eligible historical comparison, deterministic next-step playbooks, strict-review simulation, a private unsigned passport and a native DOM renderer with a React lifecycle wrapper.

`src/server/assurance-api.ts` provides read-only request handling. `assurance-app.ts` composes it before the original Hono catch-all. `runtime.ts` wires the wrapper using the existing receipt secret and store. Original auth, API routes, workers and scanner invocation remain intact.

`HostedReleaseEvidence.tsx` and `UploadedReleaseBrief.tsx` mount the companion in actual release detail screens. These are additive mounts; the approved main interface, original findings, exceptions, proof-sharing and scan controls remain. The companion is advisory, not a replacement global verdict or deployed gate. No new package dependency, database migration, background task or analytics provider was added.

## New routes

- `GET /api/assurance/releases/:id` uses the existing session-authorised release/receipt reads. Optional `compareTo` selects an earlier compatible authorised release. Default comparison reads one history page and at most three candidate receipts.
- `GET /api/assurance/uploads/:uuid` uses the existing authorised upload record. Pending work returns 202 without an invented result. Arbitrary uploads do not get inferred historical identity from a filename.
- `GET /api/assurance/scans/:uuid` uses the existing bearer-token result route. This is a machine-readable integration surface, NOT an MCP server or autonomous LLM agent.

No POST/PATCH/PUT/DELETE operation is implemented. No new crawl, release, approval, exception, charge, email or provider call is triggered. “Refresh saved snapshot” means read again, not rescan production.

## Tests actually run

101 shared domain/API cases passed under Node 22.16.0's native test runner with TypeScript stripping. The same cases are registered by two Vitest wrappers. API tests execute the actual handler with injected read/signature ports; they do not run the real Hono session, database, token or cryptographic integration.

55 browser checks passed against the actual native renderer, validator and export helper, using synthetic evidence at 390/768/1440 pixels. Keyboard details, reversible preview, focus, escaped filenames, real JSON download, private export contents, reduced motion, unmount cleanup and overflow were checked. This is not the complete React application or live API/browser acceptance.

Strict semantic checks passed for the dependency-free domain, native renderer/client, request handler and shared test cases using the available TypeScript 5.8.3 compiler. All 15 touched/new source files passed transpilation syntax checks. The repository pins TypeScript 6; this does not replace its full semantic build.

## Environment limitations

This runtime could not resolve GitHub/npm from the terminal and did not have the full locked checkout/dependencies. Publication used the authenticated GitHub connection. The first GitHub Actions review run `34268285866` and original CI run `34268285788` failed before test steps ran. Cause was not established. Do not report those runs as tests passing or assume subsequent runs pass. The bootstrap workflow's temporary source/dependency archive steps were removed from the final review workflow; no archive was obtained.

## Required next, in order

1. Read the actual PR diff. Confirm the changed source hashes against `SOURCE-HASHES.json`.
2. Run `npm ci`, then `npm test -- tests/assurance.test.ts tests/assurance-api.test.ts`, full supported regression, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run build:api`. Do not edit tests while a run is in progress.
3. Add and run full Hono composition tests with real signed fixtures and the real store. Cover anonymous access, viewer reads, removed members, revoked tokens, multiple installations/workspaces, expired billing, historical receipt loss, cancellation and the unchanged original routes.
4. Exercise both real release detail mounts in the integrated app: direct refresh, navigation, error/retry, loading, changing workspace, off-page release, signed export, exception controls and keyboard/mobile flows. Check the existing proof-step and approval focus targets and avoid duplicate/conflicting verdicts.
5. Reconcile the old headline readiness model with the new evidence companion in a separate tested cutover. In particular, the old `src/watch/release-brief.ts` treats attestation `present` as identity verified. The companion deliberately does not. Do not equate presence with cryptographic verification. Also keep after-deployment observations out of before-deployment blocking requirements.
6. Only after those checks, implement the next acceptance rows in `ACCEPTANCE.md`, starting with stable release-stream identity and a persisted, human-adopted baseline. Do not rename filenames into identity or build a parallel scanner.
7. Obtain the separate operational approvals and private-deployment verification before any live rollout. Keep this PR draft/unmerged until the applicable review is complete.

## Reproduce the focused checks

```sh
node --experimental-strip-types --test scripts/test-assurance.mjs
npm test -- tests/assurance.test.ts tests/assurance-api.test.ts
```

Optional native browser harness, after installing the locked dependencies and separately providing Python Playwright/Chromium:

```sh
node --experimental-strip-types scripts/prepare-assurance-browser.mjs .assurance-review
python scripts/check-assurance-browser.py .assurance-review
```

`NOSPOILERS_REVIEW_TYPESCRIPT_PATH` and `CHROMIUM_PATH` are optional local harness overrides, not application settings. Keep generated fixture pages, bundles and screenshots out of public deployment assets. They contain synthetic data and are not marketing screenshots of a production customer.

## Commercial and safety boundaries

Solo remains $29/month and Team $99/month, both USD; the shared five-day trial remains. No higher-price tier or promised free/no-card pilot was enabled. Disclosure Desk remains internal and unsent. Its commercial states are not replaced with a new CRM. Evidence retention remains the existing configurable policy, not an indefinite archive promise. Public proof sharing remains the existing explicitly authorised mechanism.

The first three existing files were copied from the base with Git blob hashes checked before minimal edits: runtime `d8907d6b445dba07b0d55b3dd4e6752891804c94`; hosted evidence `adad80ffe32b09e29581c9137ff8edc3032f6d01`; upload brief `64238c78d9cdad4e49374bdf4aa0176997aa3d85`.

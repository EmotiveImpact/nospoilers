# Gate A implementation checkpoint

5 September 2026. Code implemented locally; **launch gate remains open** until deployment validation below. This is not a security certification. Preserve the approved product direction and existing mockups.

## Deployment decision — deferred by owner

5 September 2026: **do not install or require Docker on the owner's Mac.** Worker deployment and runtime isolation verification are deferred while product implementation continues. Railway is the preferred candidate to assess later, not an already-verified isolation solution. The security requirement is bounded, isolated processing of untrusted artifacts; Docker is not a product requirement.

The existing code still requires container mode for production parsing. Before enabling live customer scans, adapt that implementation to the selected hosted-worker architecture and verify its boundaries. Do not simply remove the guard or label Gate A closed. Existing Docker packaging is an unused implementation option, not the next task; no local installation, image download or deployment is authorized by this decision.

## 21 September hosted-readiness checkpoint

Repository-side startup now fails closed through `npm run worker:hosted`. The preflight validates the hosted worker configuration without printing secret values and then performs a real clean scan through the configured immutable scanner image. This does not require Docker on the owner's Mac. It applies only to the future hosted worker.

The inspected `railway.toml` still uses Railpack. That build installs the Node application but does not establish a worker-local container daemon or make `Dockerfile.scanner` available to a runtime daemon. The service is also not linked to a Railway project. As a result, the checked-in service cannot pass preflight in its current external environment. This is an explicit deployment blocker rather than permission to use development process mode. A remote `DOCKER_HOST` is rejected because the daemon would resolve the read-only bind source outside the worker's staged-file filesystem.

Before a hosted scan can be accepted, an operator must complete this finite sequence:

1. Link the intended Railway project and a dedicated worker service to this repository and reviewed branch. Do not enable the Vercel deployment for `codex/release-assurance-spine-v1`; its guard remains `false` in `vercel.json`.
2. Provide an executor local to that service and prove that it supports the current `docker run` controls and sees the worker's generated staging path. Make the scanner image built from `Dockerfile.scanner` available to that executor under an immutable `sha256:<image-id>` or `registry/repository@sha256:<digest>` reference. Leave `DOCKER_HOST` unset. If Railway cannot supply this mount-local executor, stop: implement and review a different sandbox adapter before deploying.
3. Set `NODE_ENV=production`, `DATABASE_URL` to the shared external Postgres database, `APP_BASE_URL` to the final HTTPS web origin, `NOSPOILERS_SCANNER_MODE=container`, `NOSPOILERS_SCANNER_IMAGE` to that immutable reference and `NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER` to exactly `slack` or `resend`. The hosted script supplies `NOSPOILERS_ROLE=worker`.
4. Set the complete GitHub configuration on web and worker: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_APP_SLUG`. Configure GitHub's callback, setup and webhook URLs as `${APP_BASE_URL}/api/auth/github/callback`, `${APP_BASE_URL}/api/github/setup`, and `${APP_BASE_URL}/api/webhooks/github`.
5. Set the same strong `SESSION_SECRET` and `RECEIPT_SECRET` on web and worker. They must be explicit, distinct from each other and from `GITHUB_WEBHOOK_SECRET`, and at least 32 characters. The worker uses the shared session secret to decrypt workspace notification destinations; a mismatched value makes delivery fail closed.
6. For email, set `RESEND_API_KEY` and a valid public `RESEND_FROM_EMAIL`, then select `resend`. For Slack, select `slack`; each workspace owner/admin must save its own webhook through the authenticated product flow. Saving a destination does not send historical alerts.
7. Run the commands below in the proposed worker runtime. Do not start queue processing unless preflight exits zero. Then complete one new, private, disposable GitHub installation/repository flow: sign in, select the repository, publish or request one supported release-asset scan, wait for the worker, reopen the saved signed result, and verify one newly generated destination delivery. Use a destination saved before that new alert.

```bash
npm run worker:preflight
curl --fail --silent --show-error "$APP_BASE_URL/api/health"
curl --fail --silent --show-error "$APP_BASE_URL/api/ready"
psql "$DATABASE_URL" -Atc "select id from schema_migrations where id='122_connected_workspace_notification_outbox'"
psql "$DATABASE_URL" -Atc "select status,count(*) from workspace_notification_jobs group by status order by status"
psql "$DATABASE_URL" -Atc "select status,count(*) from notification_deliveries where workspace_id is not null group by status order by status"
```

The expected first command output is one JSON line with `ok:true`, `role:"worker"`, an external database mode, `scanner:"worker-local-container"`, and the selected notification path. The database checks contain identifiers/status counts only; do not export alert bodies, findings, encrypted destination values or private receipt data. Migration `122_connected_workspace_notification_outbox` installs a future-only `AFTER INSERT` alert trigger. It does not enumerate existing alerts or create historical notification jobs. GitHub delivery retries resolve to the existing alert and therefore do not create a second job.

Next workstream: Gate B — approved product journey and real API/state parity, starting with New Scan through Coverage and Releases, then Overview, Alerts and receipt presentation. Keep this deployment debt visible without blocking local product work.

## Implemented controls

- Browser and bearer-token CI artifact submissions enqueue the same durable uploaded-scan worker path. Installation completions publish through the release ledger; personal scans remain user-owned durable records, not fabricated GitHub installations.
- `POST /api/v1/scan` now returns 202 with `uploadId` and `statusUrl`. `GET /api/v1/scans/:id` requires a valid token for that installation. CLI and generated Action poll the result and fail closed on failure/timeouts. External clients must migrate from the former synchronous response.
- Browser results stay behind authentication in `/watch/releases?upload=<id>`. Anonymous intake stages input, not results. Production parsing requires the restricted container mode.
- Admission includes scoped membership, billing, suspension, usage reservation and idempotency. Viewer roles deny workspace writes; unknown roles fail closed. Completed upload evidence is immutable at the database layer.
- Database-backed staging budgets: 256 MiB public, 1 GiB aggregate, 1,000 staged objects. Request reads have byte limits and deadlines; queued expiry clears bytes. Job reservations track their original UTC day and refund once where appropriate.
- Worker claims serialize capacity admission, include personal-account concurrency, heartbeat leases and owner-checked job completion. Uploaded evidence completion is fenced by lease ownership. Unchanged website checks refund their reservation.
- Production parser invocation has no network, read-only filesystem, unprivileged UID, restricted capabilities, CPU/memory/PID/time limits and bounded output. Secrets are not passed to the parser. Local subprocess mode is development-only, **not a hostile-code sandbox**.
- Fetches for web assets, npm artifacts, GitHub release assets, delivery checks and SIEM use DNS-vetted pinned HTTPS connections, bounded responses and explicit redirect handling. GitHub credentials are removed on the permitted asset-CDN hop.
- Schema marker: `070_immutable_upload_results`. Migration completion is recorded after final checks.

## Verification and release blockers

Verification: `env NOSPOILERS_INTERNAL_LOCAL_SCAN=1 npm test -- --maxWorkers=2` passed **560 tests in 73 files**. `npm run build` and `npm run build:api` passed. Lint has no errors and two existing ScanPage effect warnings; `git diff --check` passed. Focused scoped queue, staging, immutable evidence, pinned transport and upload tests pass. The standalone bundled parser executes a real clean fixture. The container packaging configuration was corrected and its bundle separately executed after the full suite began; Docker execution remains unverified.

Before calling Gate A closed:

1. Deferred: assess Railway or another selected hosted worker and adapt the parser boundary to it. Test hostile archives, timeout/OOM termination, denied network/filesystem access and cleanup after worker death. Do not require local Docker; configuration flags and a working bundle are not runtime isolation evidence.
2. Run concurrent admission, stale-worker/retry and migration tests against production-like PostgreSQL, not only PGlite. Review non-upload legacy worker persistence for equivalent stale-owner fencing before expanding workloads.
3. Deferred: provision the selected separate worker service and document its verified execution configuration. Current code uses `NOSPOILERS_ROLE=worker` and requires container mode in production; that is an implementation constraint to adapt, not a requirement imposed on the owner. Do not assume a Vercel web function can run this worker.
4. Validate ingress body/time/concurrency limits and trusted proxy configuration. Forwarded IPs are ignored unless `NOSPOILERS_TRUST_PROXY=1`; enable only behind a proxy that replaces untrusted headers. Database staging limits do not replace ingress memory/concurrency limits. Confirm provider upload-size constraints before promising 80 MiB uploads.
5. Verify authenticated browser/CI scans, revocation, cross-tenant access, billing expiry, refunds, signed evidence reopening and recovery end to end in a private deployment. Validate secret provisioning, backups/restoration, monitoring and alerting. Do not enable local-review authentication there.

No deployment, push, infrastructure purchase or production migration was performed as part of this checkpoint. Enterprise SSO/SCIM, independent organization ownership, compliance evidence and the physical web/app monorepo split remain later work; this implementation does not imply they exist.

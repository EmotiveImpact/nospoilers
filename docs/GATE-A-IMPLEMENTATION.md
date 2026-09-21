# Gate A implementation checkpoint

5 September 2026. Code implemented locally; **launch gate remains open** until deployment validation below. This is not a security certification. Preserve the approved product direction and existing mockups.

## Deployment decision

5 September 2026: **do not install or require Docker on the owner's Mac.** Docker is not a product requirement; the security requirement is bounded, isolated processing of untrusted artifacts.

21 September 2026: the selected hosted split is Vercel for web/API, Railway for the persistent queue worker and a fresh Vercel Sandbox microVM for every untrusted scan. The owner selected a new Vercel account/project for this deployment; do not reuse the prior account. The existing worker-local container executor remains supported where a local daemon and mount namespace exist, but Railway must use the reviewed `vercel-sandbox` adapter. Do not remove the isolation guard or label Gate A closed before live acceptance.

## 21 September hosted-readiness checkpoint

Repository-side startup fails closed through `npm run worker:hosted`. The preflight validates hosted worker configuration without printing secret values and performs a real clean scan through the configured isolated executor before queue processing starts. This does not require Docker on the owner's Mac.

The Railway project, dedicated worker service and external PostgreSQL service are provisioned. Railpack installs the application but intentionally does not attempt Docker-in-Docker. The worker remains fail-closed because the fresh Vercel project, scoped credentials and immutable VCR scanner digest are not yet configured. This is an explicit deployment blocker rather than permission to use development process mode. A remote `DOCKER_HOST` remains rejected because the daemon would resolve the read-only bind source outside the worker's staged-file filesystem.

The Sandbox adapter uses `@vercel/sandbox` 3.3.0. It accepts only a repository in the authenticated project or a fully qualified VCR team/project/repository reference pinned by `sha256` digest. Each session is nonpersistent, one vCPU and deny-all network. Only bounded parser input is uploaded; Vercel control-plane credentials stay in Railway. The custom image starts as uid65532 for staging and contains a separate uid65533 parser identity. Its sudoers rule permits transition only to that parser identity, never root. Uploaded files are0444, directories are0555 and the worker proves uid65533 cannot write the staging tree before parsing. Report size is bounded and parser/command/session/cleanup deadlines fail closed. The sandbox must stop after success or failure. Vercel's control surface does not expose exact one-for-one equivalents for every Docker flag, so live hostile-input and cleanup testing is mandatory.

Before a hosted scan can be accepted, an operator must complete this finite sequence:

1. In the owner's fresh Vercel account, create the production project and link the reviewed repository. Record its team and project IDs. Do not copy the previous account's project token or project identity.
2. Build `Dockerfile.scanner` as a `linux/amd64` image into that project's Vercel Container Registry. Inspect the final image and record the immutable digest. Configure `NOSPOILERS_SCANNER_IMAGE=nospoilers-scanner@sha256:<digest>` or the fully qualified `vcr.vercel.com/<team>/<project>/nospoilers-scanner@sha256:<digest>` form. Mutable tags and other registries are rejected.
3. Create a least-privilege access token scoped to only the fresh project. Set `VERCEL_TOKEN`, `VERCEL_TEAM_ID` and `VERCEL_PROJECT_ID` on the Railway worker. Never put them in the scanner VM environment, repository, logs or web frontend.
4. Set `NODE_ENV=production`, `DATABASE_URL` to the shared external Postgres database, `APP_BASE_URL` to the final fresh-account HTTPS origin, `NOSPOILERS_SCANNER_MODE=vercel-sandbox`, the digest-pinned scanner image and `NOSPOILERS_HOSTED_NOTIFICATION_PROVIDER` to exactly `slack` or `resend`. The hosted script supplies `NOSPOILERS_ROLE=worker`; leave `DOCKER_HOST` unset.
5. Set the complete GitHub configuration on web and worker: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_APP_SLUG`. Configure GitHub's callback, setup and webhook URLs as `${APP_BASE_URL}/api/auth/github/callback`, `${APP_BASE_URL}/api/github/setup`, and `${APP_BASE_URL}/api/webhooks/github`.
6. Set the same strong `SESSION_SECRET` and `RECEIPT_SECRET` on web and worker. They must be explicit, distinct from each other and from `GITHUB_WEBHOOK_SECRET`, and at least 32 characters. The worker uses the shared session secret to decrypt workspace notification destinations; a mismatched value makes delivery fail closed.
7. For email, set `RESEND_API_KEY` and a valid public `RESEND_FROM_EMAIL`, then select `resend`. For Slack, select `slack`; each workspace owner/admin must save its own webhook through the authenticated product flow. Saving a destination does not send historical alerts.
8. Run the commands below in the proposed worker runtime. Do not start queue processing unless preflight exits zero. Prove the sandbox starts the expected digest/uid, has no outbound network, rejects hostile symlinks/special files and oversize inputs, enforces time/report bounds and stops after success, failure and worker interruption. Then complete one new, private, disposable GitHub installation/repository flow: sign in, select the repository, publish or request one supported release-asset scan, wait for the worker, reopen the saved signed result, and verify one newly generated destination delivery. Use a destination saved before that new alert.

```bash
npm run worker:preflight
curl --fail --silent --show-error "$APP_BASE_URL/api/health"
curl --fail --silent --show-error "$APP_BASE_URL/api/ready"
psql "$DATABASE_URL" -Atc "select id from schema_migrations where id='122_connected_workspace_notification_outbox'"
psql "$DATABASE_URL" -Atc "select status,count(*) from workspace_notification_jobs group by status order by status"
psql "$DATABASE_URL" -Atc "select status,count(*) from notification_deliveries where workspace_id is not null group by status order by status"
```

The expected first command output is one JSON line with `ok:true`, `role:"worker"`, an external database mode, `scanner:"vercel-sandbox-microvm"`, and the selected notification path. The database checks contain identifiers/status counts only; do not export alert bodies, findings, encrypted destination values or private receipt data. Migration `122_connected_workspace_notification_outbox` installs a future-only `AFTER INSERT` alert trigger. It does not enumerate existing alerts or create historical notification jobs. GitHub delivery retries resolve to the existing alert and therefore do not create a second job.

Next workstream: Gate B — approved product journey and real API/state parity, starting with New Scan through Coverage and Releases, then Overview, Alerts and receipt presentation. Keep this deployment debt visible without blocking local product work.

## Implemented controls

- Browser and bearer-token CI artifact submissions enqueue the same durable uploaded-scan worker path. Installation completions publish through the release ledger; personal scans remain user-owned durable records, not fabricated GitHub installations.
- `POST /api/v1/scan` now returns 202 with `uploadId` and `statusUrl`. `GET /api/v1/scans/:id` requires a valid token for that installation. CLI and generated Action poll the result and fail closed on failure/timeouts. External clients must migrate from the former synchronous response.
- Browser results stay behind authentication in `/watch/releases?upload=<id>`. Anonymous intake stages input, not results. Production parsing requires a reviewed isolated executor (`container` or `vercel-sandbox`), never process mode.
- Admission includes scoped membership, billing, suspension, usage reservation and idempotency. Viewer roles deny workspace writes; unknown roles fail closed. Completed upload evidence is immutable at the database layer.
- Database-backed staging budgets: 256 MiB public, 1 GiB aggregate, 1,000 staged objects. Request reads have byte limits and deadlines; queued expiry clears bytes. Job reservations track their original UTC day and refund once where appropriate.
- Worker claims serialize capacity admission, include personal-account concurrency, heartbeat leases and owner-checked job completion. Uploaded evidence completion is fenced by lease ownership. Unchanged website checks refund their reservation.
- Production parser invocation has no network, read-only input, unprivileged UID, bounded CPU/session/time/output and no application credentials. The local container profile additionally enforces its Docker capability, memory, swap, PID and root-filesystem flags. Vercel Sandbox supplies a microVM/provider boundary with a different control surface; the adapter preserves deny-all egress, a 512 MiB Node heap and one vCPU but does not claim one-for-one Docker flag equivalence. Local subprocess mode is development-only, **not a hostile-code sandbox**.
- Fetches for web assets, npm artifacts, GitHub release assets, delivery checks and SIEM use DNS-vetted pinned HTTPS connections, bounded responses and explicit redirect handling. GitHub credentials are removed on the permitted asset-CDN hop.
- Schema marker: `070_immutable_upload_results`. Migration completion is recorded after final checks.

## Verification and release blockers

Verification: `env NOSPOILERS_INTERNAL_LOCAL_SCAN=1 npm test -- --maxWorkers=2` passed **560 tests in 73 files**. `npm run build` and `npm run build:api` passed. Lint has no errors and two existing ScanPage effect warnings; `git diff --check` passed. Focused scoped queue, staging, immutable evidence, pinned transport and upload tests pass. The standalone bundled parser executes a real clean fixture. The container packaging configuration was corrected and its bundle separately executed after the full suite began; Docker execution remains unverified.

Before calling Gate A closed:

1. Create the fresh Vercel project/token/VCR digest and configure the already-provisioned Railway worker. Run live hostile archive, denied network/filesystem, timeout/resource and cleanup-after-worker-death acceptance. Repository tests and successful Sandbox creation alone are not runtime isolation evidence.
2. Run concurrent admission, stale-worker/retry and migration tests against production-like PostgreSQL, not only PGlite. Review non-upload legacy worker persistence for equivalent stale-owner fencing before expanding workloads.
3. Capture the verified Railway/Vercel execution configuration without secret values. The Railway service must remain the persistent `NOSPOILERS_ROLE=worker`; Vercel web functions and individual Sandbox sessions do not replace the queue worker.
4. Validate ingress body/time/concurrency limits and trusted proxy configuration. Forwarded IPs are ignored unless `NOSPOILERS_TRUST_PROXY=1`; enable only behind a proxy that replaces untrusted headers. Database staging limits do not replace ingress memory/concurrency limits. Confirm provider upload-size constraints before promising 80 MiB uploads.
5. Verify authenticated browser/CI scans, revocation, cross-tenant access, billing expiry, refunds, signed evidence reopening and recovery end to end in a private deployment. Validate secret provisioning, backups/restoration, monitoring and alerting. Do not enable local-review authentication there.

The repository-side adapter is implemented and the Railway/Postgres services are provisioned, but the fresh Vercel project, token, image and live acceptance are not complete at this checkpoint. Enterprise SSO/SCIM, independent organization ownership, compliance evidence and the physical web/app monorepo split remain later work; this implementation does not imply they exist.

# Gate A implementation checkpoint

5 September 2026. Code implemented locally; **launch gate remains open** until deployment validation below. This is not a security certification. Preserve the approved product direction and existing mockups.

## Deployment decision — deferred by owner

5 September 2026: **do not install or require Docker on the owner's Mac.** Worker deployment and runtime isolation verification are deferred while product implementation continues. Railway is the preferred candidate to assess later, not an already-verified isolation solution. The security requirement is bounded, isolated processing of untrusted artifacts; Docker is not a product requirement.

The existing code still requires container mode for production parsing. Before enabling live customer scans, adapt that implementation to the selected hosted-worker architecture and verify its boundaries. Do not simply remove the guard or label Gate A closed. Existing Docker packaging is an unused implementation option, not the next task; no local installation, image download or deployment is authorized by this decision.

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

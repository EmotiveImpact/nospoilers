# Bugs, fixes and open launch issues

This is the short operational defect register. Product status lives in [docs/STATUS.md](docs/STATUS.md), planned work in [docs/ROADMAP.md](docs/ROADMAP.md), and detailed verification in [docs/release-assurance/BUILD-LOG.md](docs/release-assurance/BUILD-LOG.md).

## Open

| Issue | Current state | Next action |
| --- | --- | --- |
| Normal customer login is still GitHub-only | Provider-neutral database foundation is complete; Neon Auth is selected but not active | Verify the new Neon account email, enable Managed Better Auth, configure trusted domains, then connect and test the sign-in UI |
| Hosted customer journey is not accepted end to end | GitHub webhook transport is repaired and the secure existing-personal-installation reconnect is implemented | Deploy, attach installation 158159401 to the production workspace, then prove queued scan → saved result |
| Sandbox adversarial acceptance is incomplete | Clean, fail-closed encrypted input, denied egress, timeout and stopped cleanup passed live | Complete special-file/oversize and worker-interruption cleanup acceptance |
| GitHub Actions is externally blocked | The earlier run did not start because of the account payment/spending limit | Resolve the GitHub account block and rerun CI on the current commit |
| Real notification delivery is not accepted | Delivery code and worker preflight exist | Configure one approved provider and verify one private, workspace-scoped notification |
| Native accessibility acceptance remains | Responsive and automated keyboard coverage exists | Complete native 200% zoom and audible screen-reader checks |
| Stripe cannot take payment | Deliberately deferred by the owner | Configure sandbox prices, keys and webhook later; then test checkout, entitlement changes, cancellation and expiry |

## Fixed on 21–22 September 2026

| Problem | Fix | Evidence |
| --- | --- | --- |
| Clicking an existing open alert showed unavailable; its next-step controls also failed | Normalize PostgreSQL BIGINT alert/source/event IDs into safe numeric API IDs; distinguish pending/failed detail requests from unavailable records | Live database confirmed alert 1 is open and IDs arrive as strings; all 43 alert tests across 24 files, frontend/API builds and diff check passed |
| Coverage's Open repository only navigated to configuration, appearing to do nothing | The detail action is a real GitHub link for the selected repository; row selection is labelled View details, and Manage checks retains configuration access | Six Coverage detail tests, including checked/unchecked repositories and changed selection; TypeScript/frontend build |
| Alerts footer squeezed the history explanation into a narrow column beside its buttons | Separate compact count/controls from the full-width history note; prevent footer shrinking and wrap rows at narrow widths | 12 alert UI/keyboard tests; TypeScript/frontend build |
| Existing GitHub connection name was nearly black on its dark panel | Use the shared light `text-snow` foreground for the account name | Connection UI tests 4/4 and TypeScript/frontend build passed |
| Product identity was coupled to a GitHub numeric ID | Added `product_auth_identities` keyed by trusted issuer/subject with stable internal user IDs | Provider-neutral identity and repeated-login tests |
| GitHub OAuth credentials lived on the person record | Added separate `github_connector_accounts` storage and compatibility fallback | Signup and encrypted-token tests |
| Disconnecting GitHub would sign every account type out of NoSpoilers | Provider-neutral sessions now survive connector revocation; legacy GitHub-only behavior remains | Signed webhook regression |
| Internal owner access depended on a mutable GitHub login | Added stable `ADMIN_USER_ID`; token and transitional login methods remain | Owner/operator authorization regression |
| An identity or GitHub account could be at risk of concurrent reassignment | Conflict-safe insert/update logic rejects a different owner | Conflict and concurrency-oriented store tests |
| Vercel and Railway could have used different databases | Both were verified against the same fresh Neon project without logging credentials | Sanitised infrastructure comparison recorded in the build log |
| Railway lacked a safe untrusted scanner boundary | Added a fresh digest-pinned Vercel Sandbox microVM per scan | Live clean scan and hosted worker preflight |
| Vercel Hobby rejected the hourly cron | Removed the duplicate Vercel schedule; the persistent Railway worker owns recovery and polling | Fresh Vercel import no longer requires the paid cron frequency |
| Migration-current test was pinned to migration 122 | Test now follows `CURRENT_SCHEMA_MIGRATION` | Final 1,660-test regression |
| Production GitHub webhooks returned 401 | Rotated one shared secret across GitHub, Vercel and Railway and redeployed | Two subsequent push deliveries returned 200 and were staged in Neon |
| Fresh Neon could not attach the still-active personal GitHub installation | Added owner-proved existing-personal reconnect with short-lived intent and atomic workspace binding | 15 focused tests and final 1,665-test regression |

## Reporting a new issue

Record the affected route or command, exact state, expected behavior, actual behavior and whether data or permissions are involved. Do not include secrets, packed customer source or credential values in this file.

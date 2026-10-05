# Bugs, fixes and open launch issues

This is the short operational defect register. Product status lives in [docs/STATUS.md](docs/STATUS.md), planned work in [docs/ROADMAP.md](docs/ROADMAP.md), and detailed verification in [docs/release-assurance/BUILD-LOG.md](docs/release-assurance/BUILD-LOG.md).

## Open

| Issue | Current state | Next action |
| --- | --- | --- |
| Normal customer login is still GitHub-only | Provider-neutral database foundation is complete; Neon Auth is selected but not active | Verify the new Neon account email, enable Managed Better Auth, configure trusted domains, then connect and test the sign-in UI |
| Hosted customer journey is not accepted end to end | GitHub webhook transport is repaired and the secure existing-personal-installation reconnect is implemented | Deploy, attach installation 158159401 to the production workspace, then prove queued scan → saved result |
| Sandbox adversarial acceptance is incomplete | Clean, fail-closed encrypted input, denied egress, timeout and stopped cleanup passed live. Graceful worker-interruption cleanup is implemented and test-covered (5 October 2026), not yet exercised live | Complete special-file/oversize acceptance and one live Railway redeploy during a running scan |
| GitHub Actions is externally blocked | The earlier run did not start because of the account payment/spending limit | Resolve the GitHub account block and rerun CI on the current commit |
| Real notification delivery is not accepted | Delivery code and worker preflight exist | Configure one approved provider and verify one private, workspace-scoped notification |
| Native accessibility acceptance remains | Responsive and automated keyboard coverage exists | Complete native 200% zoom and audible screen-reader checks |
| Stripe cannot take payment | Deliberately deferred by the owner | Configure sandbox prices, keys and webhook later; then test checkout, entitlement changes, cancellation and expiry |

## Fixed on 3 October 2026

| Problem | Fix | Evidence |
| --- | --- | --- |
| Copy brief left its button unchanged and added a separate success message | Keep the copy icon and show Copied inside the button; reset on reopen and retain truthful manual-copy guidance on clipboard failure | 38 focused fix-brief/guidance tests across two files, typecheck, standard frontend build, affected-file lint and diff check passed; deployment and live copy verification are recorded in BUILD-LOG |
| Watch mixed font exceptions, title sizes, field heights and unscoped dialog typography | Selected Cal Sans Text UI and documented shared tokens; aligned main screens, fields/panels/pagination and all 13 Watch dialog roots, keeping evidence monospace and standalone Scan scope | 153 local affected UI tests and full CI 1,821/287 passed, plus typecheck, standard frontend/API builds and lint; deployed font/licence hashes, dialog monospace, real paging and desktop/390px/320px layouts are verified in BUILD-LOG |
| Mobile Alerts spent separate rows on export and Assigned to me, and repeated keyboard-help text | Put the two controls in one responsive action group and remove the shortcut disclosure on all screen sizes; keep filter state and keyboard navigation | Seven focused queue/filter tests, typecheck, frontend bundle, lint and diff check passed; deployed 390px/1280px alignment and filter toggling are verified |
| Watch named Inter without loading it, while popup menus could inherit the marketing font | Bundled unmodified Inter variable upright/italic faces and a shared UI font token; repository/account popup surfaces and shared pickers use it | 29 focused tests, typecheck, bundle and diff check passed; deployed assets match source hashes, licence returns 200, and live mobile drawer/workspace popup use the shared family; see docs/UI-TYPOGRAPHY.md |
| Expanded sidebar collapse control sat too far inside the workspace picker | Shifted only the expanded desktop control 8px right, retaining its 32px target and the compact/mobile layouts | 15 shell/navigation tests, typecheck, frontend bundle and diff check passed; production confirms matching right edges and working collapse/expand |
| See plans in the expired Coverage notice left the app for public pricing | Use the existing in-app Plan & billing tab, preserve workspace/connection scope and clear stale detail/pagination controls; share the destination across Watch plan actions | Reproduced on production; 80 focused navigation, access and workspace UI tests, typecheck/frontend bundle and diff checks passed; deployment verification is in BUILD-LOG |
| Longer lists either showed every loaded result or used fixed 50-row pages with no size choice | Shared default-10 pagination with 30/60 choices, Next/Previous, scope/filter resets and error guards; server-backed lists fetch the requested size, and uploaded-build search filters the full authorized history | SQL/API, cursor, search, stale-response and UI checks are recorded in the latest BUILD-LOG; existing bounded Timeline/audit/team-activity windows remain explicit |
| Search zoomed across from the top-right trigger and labelled static navigation Recent | Fade in place; group Pages, Alerts, Sources, Releases and Actions; rank name matches and support common page names, clear/close controls and scoped billing navigation | 53 focused search/navigation/accessibility tests, build, lint and diff check passed; live desktop/mobile have no transforms or document overflow, correct ranking/navigation and focus return |
| Overview’s Review alert button included an unwanted arrow | Show the alert action as text only, preserving its selected-alert destination | 29 Overview UI tests, TypeScript/frontend build and diff check passed; live Review alert has no SVG and retains its exact-alert destination |
| Selected New scan cards had a second line above their bottom border | Removed the decorative 2px stripe and native button edge, retaining the existing 1px red outline for every evidence type | Live styles identified the duplicate pseudo-element; 30 scan tests, TypeScript/frontend build and diff check passed |
| Team invitation role picker sat above the account field and send button | Moved role guidance below the control row and matched the picker height to the 40px input/button; selected-role help remains associated with the picker | 13 Team UI tests, TypeScript/frontend build, lint and diff check passed; live 1280px controls align at 40px height, role explanations update and 390px layout has no document overflow |
| Related text and controls appeared disconnected across Watch screens | Removed stacked empty-state padding and reduced heading, prose, form and section gaps; shared page intros now have one owning style | 121 focused tests across 13 files, 52 follow-up tests, frontend/TypeScript build and affected-file lint; real deployed desktop/mobile checks recorded in BUILD-LOG |
| Alerts became unreadable when a short viewport left only 49px for its body | At heights up to 600px, scroll the complete page instead of squeezing the detail under its header | Live 640×400 check reached the explanation and bottom response controls; native zoom remains separate |
| Expired Coverage appeared blank above a long blurred repository inventory | Anchor the access notice near the top of the overlay and keep it visible while scrolling; covered controls remain inert | Real CoverageLock is exercised in the expired-state UI tests, including available subscription/navigation actions |

## Fixed on 23 September 2026

| Problem | Fix | Evidence |
| --- | --- | --- |
| Timeline event text looked disconnected from its rows | Removed superseded shared Timeline styles that overrode the redesign with 22px vertical padding and obsolete markers; reduced row height and made supporting text easier to read | Live computed style showed 22px padding and 83px rows before the fix; focused Timeline tests, frontend build and diff check passed |
| Timeline was a tall, repetitive log and its missing-release records would lead to unavailable Alerts detail | Added compact rows, source/event search, a per-day expandable group that retains each check, and repository-scoped Coverage links using the persisted repository ID | Timeline UI/API, coverage and accessibility focused tests; frontend/API builds |

## Fixed on 21–22 September 2026

| Problem | Fix | Evidence |
| --- | --- | --- |
| Scan destination and older settings/release controls used inconsistent native dropdowns | Replaced all 32 with a shared dark picker, searchable for longer lists; preserved values, disabled choices, required validation and remediation focus recovery | 1,741-test regression plus 33 focused tests after browser focus hardening; frontend/API builds and local browser interaction verification |
| Most alerts used generic rebuild advice, including repository access events | Added evidence-scoped explanations and distinct fixes for 25 scanner rules and 41 event kinds; shared guidance with the copyable agent brief and corrected event-only detail labels | 51 focused explanation/UI/keyboard tests; see docs/ALERT-EXPLANATIONS.md and latest BUILD-LOG |
| GitHub controls appeared below Websites and repeated every repository's actions | Dedicated single-repository management view with shared dark surfaces, repository selector, grouped controls and Back to Coverage; source tabs clear old configuration | Repository scope, tab cleanup, permission/confirmation and expired-state regressions; frontend build |
| Workspace selector reloaded every time the sidebar reopened | Share workspace choices in the persistent signed-in shell across desktop and mobile rails; discard choices on identity change and failed refresh | 37 workspace/shell UI tests and TypeScript/frontend build passed |
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

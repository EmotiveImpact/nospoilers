# NoSpoilers production experience plan

Date: 5 September 2026

## Product decision

NoSpoilers should use different surfaces for acquisition, activation, daily operations, and release investigation. The V20 homepage, First Proof flow, live Overview, and Release Readiness brief are complementary rather than competing designs.

The four-circle First Proof screen remains the authenticated empty state. Its original sample incident is not production data and stays removed. The circles still need to become a real activation state machine instead of a static first step.

The V20 homepage product window remains an interactive, explicitly labelled example. Its tabs explain finding categories and its Rescan animation explains the release boundary. It must not behave like a second scanner or imply that the example data belongs to the visitor.

## Visual sources

| Surface | Source of truth | Production role |
| --- | --- | --- |
| Marketing | V20 homepage package and `src/components/marketing/` | Public acquisition and product explanation |
| Watch shell | 2B plus shot C in `public/mockup-review/2b/21-stage-linear.html` | Authenticated navigation and work surface |
| Activation | supplied First Proof image plus the `1G` flow on `origin/cursor/watch-desk-ux-mockups-71d1` | First login through first real receipt |
| Daily overview | live 2B bento overview | Installation-wide status and next action |
| Alerts | current live alerts workspace, informed by `1H` and the alert queue studies | Acknowledge, assign, resolve, and verify |
| Sources | current unified Sources route, informed by `2D` object-first detail | Connected repositories, packages, websites, and custody destinations |
| Releases | Mock 3 plus the live Releases master-detail implementation | Compare releases and inspect one evidence brief |
| Settings | current route modules, informed by `1I` | Roles, policy, notifications, retention, health, tokens, and registries |

Static HTML is visual and interaction reference only. Chosen patterns are ported into React and connected to existing APIs; static pages are not embedded and stale remote branches are not merged wholesale.

## Execution sequence

1. Preserve a reviewable checkpoint and produce a screen/state inventory.
2. Wire First Proof as a four-step activation state machine: no source, checking, action required, and first sealed receipt.
3. Build a clear Scan launcher around real capabilities: package scan, production-site connection, and receipt verification. Finding-type tabs remain result filters, not scan modes.
4. Reconcile homepage claims and interactions with the launcher. Label the hero window as an example release and keep its Rescan animation as product education.
5. Complete the daily workflow: Overview → Alerts/Sources/Releases → detail → resolution → updated verdict and receipt.
6. Apply consistent loading, empty, error, ended-coverage, role, and plan states across every Watch route.
7. Polish enterprise-critical surfaces: role clarity, separation of duties, audit history, retention, notification delivery, evidence exports, and status explanations.
8. Complete accessibility, responsive, performance, and navigation-state QA.
9. Stabilize PGlite/integration tests and reduce the oversized Watch context and server modules without changing product behaviour.
10. Complete human-gated launch wiring: Stripe, Resend, Railway worker, production domain, and GitHub App webhook; then run a real-install end-to-end acceptance pass.

## Acceptance journey

A new customer can understand the product on the homepage, sign in, install the GitHub App, select a real source, see checking progress, receive a truthful clean or blocked result, open the relevant evidence, resolve an incident, obtain a release receipt, invite a teammate, export evidence, and pay without encountering sample tenant data or disconnected prototype controls.

## Evidence captured

- `01-v20-homepage.png`: current V20 acquisition surface.
- `02-current-scan.png`: current real Scan route; the fixture catalogue is below the fold and the empty result panel is visually unexplained.
- `03-live-overview.png`: current live-data operational overview.

## Explicit non-goals until customer demand

- SSO/SAML
- Sigstore/cosign verification
- Scheduled CDN verification
- Native Vercel/Netlify/Cloudflare OAuth
- SBOM attachment
- Isolated DMG/EXE/MSI/AppImage processing
- Automated malware verdicts, takedowns, outreach, or public naming

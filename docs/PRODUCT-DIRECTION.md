# NoSpoilers product direction

Last confirmed: 5 September 2026

This file is the durable product/design handoff for the current implementation. Read it before changing the authenticated customer journey, scan entry point, release views, or homepage product preview.

Current implementation gates and evidence live in `docs/ENTERPRISE-READINESS-PLAN.md`, with security findings in `docs/SECURITY-READINESS-REVIEW.md` and screen/state parity in `docs/MOCKUP-PRODUCTION-CONTRACT.md`. Website/app organization remains governed by `docs/WEB-APP-ARCHITECTURE.md`. Read and update these together; historical audit notes are supporting context, not launch approval.

## Product spine

NoSpoilers should feel like one continuous evidence journey rather than a collection of scanners.

1. **Homepage product preview** — an explicitly labelled interactive marketing example. It demonstrates the breadth of detection and the shape of a result, but never pretends to be customer data or a second production scanner.
2. **First Proof** — the honest empty-workspace screen after login. It explains the four genuine states: connect a release surface, inspect exposure, resolve findings, and seal a receipt. There is no sample workspace or invented incident.
3. **New Scan** — customers choose the release surface they want to prove: GitHub repository, package/build, production website, or existing release proof. They do not choose internal detection categories such as maps, secrets, files, or manifests; NoSpoilers selects the relevant checks automatically.
4. **Release Detail** — the authoritative view for one release. It combines the decisive Release Readiness presentation with compact, filterable evidence and remediation. The Releases index remains a master-detail selector and opens this full view explicitly.
5. **Daily Overview** — replaces First Proof as soon as real evidence exists. It summarizes the current release decision, open risk, coverage, recent activity, and next action. It must never insert demonstration findings.

## Product language and navigation

Identity/workspace direction: see `IDENTITY-WORKSPACES.md`. Product sign-in is separate from GitHub source installation; teammates need not connect GitHub to receive NoSpoilers assignments. Target independent billing organisations/workspaces with multiple approved source connections. Proposed Solo 2 / Team 5 / Enterprise negotiated (20 starting proposal) are not current entitlements.

- **Coverage** is the persistent inventory of repositories, packages, production websites, and private map destinations that NoSpoilers watches. Keep the existing `/watch/sources` route internally for compatibility, but use “Coverage” in customer-facing navigation and headings.
- **New scan** is an action, not an inventory section. It can connect GitHub, start a one-off package/build or website check, or verify an existing release proof. Authenticated product UI exposes it globally and contextually rather than adding another sidebar inventory section.
- **GitHub from New Scan** creates ongoing Coverage and queues the first Release check. A one-off package upload creates a Release only; it becomes Coverage only if the customer explicitly links a registry or enables monitoring.
- **Releases** are the durable results produced by scans and monitoring. The releases index is history and selection; Release Detail is the decision and evidence workspace.
- **Alerts** are actionable exposure changes discovered across Coverage. Their statuses are mutually exclusive: Open, In progress, and Resolved. Assignment is an independent filter.

## Acquisition scan gate

The public scan is an acquisition hook, but it must not disclose a vulnerability report to an anonymous visitor.

1. The V20 homepage and `/scan` let a visitor choose a package/build or enter a production URL before authentication.
2. Submission creates a short-lived, opaque pending-scan intent. No scanner runs and no findings exist before authentication; the anonymous response contains only the intent identifier.
3. The reveal action authenticates the visitor, claims the pending scan, starts the customer trial, runs the scan, and redirects into the authenticated First Proof or Release Detail flow.
4. Production URLs require an ownership check before detailed evidence is exposed. This prevents NoSpoilers becoming a free reconnaissance tool against third-party sites.
5. Pending uploads/results expire quickly and cannot be enumerated or claimed by a different browser session.

The trial is **five days**: urgent enough to drive evaluation, long enough for an enterprise buyer to involve a second stakeholder. Trial creation, billing handoff, legal copy, and lifecycle messaging must all use the shared five-day policy.

For local product review, do not restore query-string impersonation such as `?as=trial`. Use the standalone prototype for visual review, real GitHub OAuth when configured, or a deliberately opt-in development-only seeded session that is impossible to enable in production.

The route boundary is explicit: `/scan` belongs to the public website and `/watch/scan` belongs to the authenticated product. The target repository and deployment structure is recorded in `docs/WEB-APP-ARCHITECTURE.md`.

## Approved design principles

- Use the established black/off-white NoSpoilers system and the product red as the primary accent.
- Red is localized to a decision, status label, icon, or primary action. Do not use long red rails or large decorative warning lines.
- Preserve dense evidence presentation where it improves investigation, but keep one dominant next action per state.
- Make state understandable without colour: every severity and verdict needs a text label.
- Keep empty, loading, checking, blocked, ready, disconnected, permission, and retry states honest and distinct.
- Reuse the current working data model and operational controls. The approved prototype is an interaction and visual target, not permission to replace functioning backend behavior with simulation.
- Marketing examples may be interactive. Authenticated customer screens may only show genuine workspace data.
- Resolving an alert does not make an artifact clean. Passing release proof requires a completed scoped check and its recorded policy decision; inconclusive work cannot pass.
- The four First Proof stages are a customer journey. Setup's five technical capabilities are optional coverage diagnostics, not mandatory onboarding steps.

## Production implementation order

1. Shared visual tokens and reusable evidence/decision components.
2. First Proof empty state and the transition to the live Overview.
3. Four-route New Scan launcher using real GitHub, package scan, website connection, and release-proof verification paths.
4. Releases index selection and full Release Detail evidence browsing.
5. Daily Overview hierarchy and next-action polish.
6. Alerts triage and resolution workflow.
7. Sources connection health and authentication states.
8. Team roles, policies, approvals, audit trail, integrations, and enterprise settings.
9. Cross-screen loading, empty, error, permissions, responsive, keyboard, and reduced-motion verification.
10. Public pre-auth scan intent, authenticated claim/reveal, five-day trial migration, and abuse/expiry protections.

## Approved visual references

- Interactive flow prototype: `public/mockup-review/master-flow/`
- Release Readiness prototype: `public/mockup-review/mock3-release-readiness/`
- First Proof source image: `public/mockup-review/master-flow/first-proof-source.png`
- Existing implementation QA and captures: `audit/`

## Definition of done

The flow is production-ready only when all visible controls use real routes or APIs, customer screens contain no invented data, each core state is tested, TypeScript/build/lint checks pass, and browser verification confirms desktop and responsive behavior with no console errors.

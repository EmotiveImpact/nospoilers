# NoSpoilers master-flow audit

Audited 5 September 2026 against the local production application and the current API surface.

## Decision

Adopt the master-flow visual system as the production UI direction, while retaining the production shell's route structure, controllers, authorization, and APIs. The prototype is a visual and interaction reference; its data is static and simulated.

Use **Release proof** as the customer-facing concept. Reserve **signed receipt JSON** for the technical artifact that can be downloaded or verified.

## Core journey

1. First Proof — healthy. Honest empty state with one dominant action and a clear four-step model.
2. Coverage — added as the persistent inventory of monitored repositories, packages, websites, and private map destinations. This replaces the ambiguous customer-facing “Sources” label while the internal route can remain stable.
3. New Scan — healthy as a separate action and launcher. It no longer doubles as the Coverage page. Needs real upload, ownership, progress, failure, and retry states.
4. Release detail — healthy. Strong decision hierarchy and evidence drill-down; requires real receipt/proof lifecycle and permissions.
5. Alerts — repaired. Open, In progress, and Resolved are mutually exclusive status queues; assignment is an independent filter. The filter controls are separated visually and behave as real tabs. Needs API wiring, pagination/search, bulk handling, empty/error/loading/permission states, and responsive QA.
6. Daily Overview — missing from this prototype. It must replace First Proof once real workspace evidence exists.

## Strengths

- Calm, enterprise-appropriate hierarchy with dense evidence presented progressively.
- Product red is local to decisions and actions rather than used as decoration.
- The centered light field gives the workspace depth without reducing legibility.
- The release and alert layouts make ownership and next action immediately visible.

## Material risks and gaps

- The prototype contains hard-coded findings and alerts and makes no API requests.
- It covers four representative screens, not the full product surface.
- The phrase “independently verifiable” overstates the current HMAC receipt model. Verification is against the issuing NoSpoilers instance until asymmetric/KMS signing is implemented.
- Sources, integrations, policies, exceptions, approvals, teams/roles, audit export, billing, notification routing, and all operational edge states still need visual coverage.
- The public acquisition flow must create an intent only; scanning and findings begin after authentication and trial activation.

## Accessibility and resilience

- Severity and verdicts use text as well as colour.
- Alerts support keyboard queue navigation and labelled status controls.
- Production implementation still requires focus-state, screen-reader, contrast, zoom, reduced-motion, and responsive verification.

## Evidence

- `01-release-detail.png` — release decision and evidence layout.
- `02-alerts-current.png` — broken Alerts layout before repair.
- `03-alerts-repaired.png` — repaired Open queue.
- `04-alerts-waiting.png` — repaired In progress state.

This is a prototype audit, not proof of production API integration or end-to-end security behavior.

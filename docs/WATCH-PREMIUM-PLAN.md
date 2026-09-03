# Watch Premium execution plan

Status: in progress on `cursor/watch-premium-10-1479` from `main` at `b14fb3b`.

## Current-state evidence

- `src/pages/WatchPage.tsx` is still 6,861 lines. It owns tenant loading, permissions, commands,
  mutation state, confirmation state, and the render trees for all 14 Watch routes.
- Some extraction already exists: `useWatchDeskController` derives routes, normalized sources,
  proof-based setup, alert views/activity, and timeline lanes; `WatchOverview`,
  `WatchAlertsWorkspace`, `WatchSourcesSummary`, `WatchCommandPalette`, and shell/data-state
  components provide a good migration seam.
- Four core configuration areas are still raw collapsibles in `WatchPage.tsx`: GitHub repositories
  (`watch-source-github`), production websites (`watch-source-web`), map custody
  (`watch-source-map`), and npm/registry packages (`watch-source-npm`). Notification configuration
  is also a raw collapsible (`watch-notification-config`). These are product features, not advanced
  help, and must become focused screens, panels, or dialogs.
- The locked reference is
  `origin/cursor/watch-desk-ux-mockups-71d1:docs/mockups/2b-full-guided.html`. Supporting evidence
  comes from 03/1C (triage), 05/1A (verdict first), 06/2D (source drilldown), 07/1I
  (desk/settings split), 08/1B (exposure), 09 (urgency composition), 10/1G (next action), and 2C
  (full triage scope). The handoff distinguishes proposed presentation from existing behavior.
- Current APIs are authoritative. Existing typed confirmation, actor separation, append-only
  receipts/events, 401/402/403 behavior, role/plan gates, and the ended-install alert exception
  remain unchanged.

## Product and design principles

1. Truth before reassurance: failed or incomplete reads never render a clean or empty verdict.
2. Risk determines hierarchy: one active incident and one next action dominate; supporting
   metrics are quieter.
3. Evidence, not connection counts: setup is complete only when each leak path has direct proof.
4. Object-first work: alerts, sources, and releases use compact list/detail geometry and keep
   context while acting.
5. Progressive disclosure is for technical explanation only. Core configuration is visible in a
   dedicated route, panel, sheet, or dialog.
6. Runtime data is always real. Preview is an honest empty state; fixtures stay under tests.
7. One visual language: 4px rhythm, restrained surfaces, semantic labelled color, Lucide icons,
   12px minimum meaningful metadata, consistent timestamps, and 120–180ms reduced-motion-safe
   transitions.
8. Accessibility is structural: labelled controls, trapped/restored focus, keyboard parity,
   textual chart equivalents, live action feedback, and mobile targets of at least 48px.

## State and route model

- URL is the durable navigation state: `/watch` plus `/watch/{view}`; query keys are `install`,
  `alert`, `release`, `source`, `sourceType`, `attention`, and `tab`.
- Data state is explicit per dataset: `loading | ready | error`. Composite state uses error
  precedence, then loading, and only then ready.
- Tenant capability state is independent: preview/authenticated; Trial/Solo/Team/ended;
  admin/member; GitHub active/suspended. Commands consult this state instead of hiding read-only
  evidence.
- Selected alert activity has its own immediate `loading | ready | error` state and retry.
- Dialog/sheet state is ephemeral local UI state. Destructive or sensitive changes retain the
  existing typed-confirmation model.
- Setup proof is `covered | open | check-needed | unknown`; no source count implies proof.

## Exact module boundaries

- `src/pages/WatchPage.tsx`: orchestration only; composes session, controller, shell, route screen,
  and dialogs. No route markup.
- `src/watch/types.ts`: shared API/domain records currently declared in the page.
- `src/watch/useWatchData.ts`: parallel tenant reads, per-dataset states, reloads, and 401/402/403
  preservation.
- `src/watch/useWatchCommands.ts`: alert/source/release/settings commands, pending/result state,
  export, and typed-confirmation dispatch.
- `src/watch/useWatchPermissions.ts`: role, plan, suspension, and ended-install capabilities.
- `src/watch/routes.ts`: parse/build URLs and route metadata.
- `src/watch/view-models.ts`: source rows/details, setup proof, alert rows, release rows, timeline
  spans, and overview priority.
- `src/components/watch/WatchRouteScreen.tsx`: lazy route switch and route-level error boundary.
- `src/components/watch/screens/OverviewScreen.tsx`
- `src/components/watch/screens/AlertsScreen.tsx`
- `src/components/watch/screens/SourcesScreen.tsx`
- `src/components/watch/screens/ReleasesScreen.tsx`
- `src/components/watch/screens/TimelineScreen.tsx`
- `src/components/watch/screens/SetupScreen.tsx`
- `src/components/watch/screens/NotificationsScreen.tsx`
- `src/components/watch/screens/PolicyScreen.tsx`
- `src/components/watch/screens/TeamScreen.tsx`
- `src/components/watch/screens/RetentionScreen.tsx`
- `src/components/watch/screens/AuditScreen.tsx`
- `src/components/watch/screens/HealthScreen.tsx`
- `src/components/watch/screens/TokensScreen.tsx`
- `src/components/watch/screens/RegistriesScreen.tsx`
- `src/components/watch/source/*`: unified rows, detail sheet, and one-form add flow.
- `src/components/watch/release/*`: ledger/detail and focused delivery, attestation, verification,
  approval/reject/hold flows.
- `src/components/watch/settings/*`: destination/routes, policy, team, retention, audit, health,
  tokens, and registries focused cards/dialogs.
- Existing shadcn-style UI primitives remain the base; Headless UI Dialog provides focus trap,
  inert backdrop, Escape, title semantics, and focus restoration where equivalent local Radix
  primitives are not installed.

## Phases and acceptance criteria

### Phase 1 — plan, state contracts, and build hygiene

- [x] Record current evidence, boundaries, gates, matrix, and non-goals in this document.
- [x] Fix localized TypeScript errors in `job-wake.ts` and `phase1-setup-pr.ts` without changing
  runtime policy; add regression tests.
- [x] Add/extend model tests for truthfulness, routes, source filters/details, setup proof,
  command keyboard behavior, mobile alert state, and retained-window spans.
- [x] Acceptance: typecheck is clean for touched contracts; no runtime fixture data.

### Phase 2 — orchestration and route extraction

- [x] Move domain types, loading, capabilities, and commands out of `WatchPage.tsx`.
- [x] Extract every route render tree into a focused screen module.
- [x] Remove all core `<details>/<summary>` disclosures.
- [x] Lazy-load the Watch workspace while preserving SPA URLs.
- Acceptance: `WatchPage.tsx` is orchestration only; APIs, mutations, status handling, typed
  confirmations, plan/role gates, and ended behavior have regression coverage.

### Phase 3 — premium desk, sources, releases, and timeline

- [x] Overview is verdict-first with dominant incident, freshness/source health, release posture,
  source lanes, proof progress, and one prioritized action.
- [x] Alerts provide desktop inbox/detail, mobile list/detail, sticky actions, pills, structured
  findings, exposure, checklist, activity retry, assignment and resolution flows, previous/next,
  and keyboard navigation.
- [x] Sources provide URL-backed type/attention filters, rich rows, source detail, and one focused
  form after choosing a source kind.
- [x] Releases provide a compact ledger/detail and focused governed actions.
- [x] Timeline provides retained-window source-lane spans, dates, legend, focus/hover detail, and
  a textual table/feed equivalent.
- [x] Acceptance: explicit loading/error/empty/clear states; no false-safe state; no invented rows.

### Phase 4 — setup, settings, and design-system polish

- [x] Setup renders five proof states and exactly one next action.
- [x] Notifications, policy, team, retention, audit, health, tokens, and registries use focused
  rows/cards/dialogs with consistent read-only and ended explanations.
- [x] Team rows use Avatar with fallback; retention preserves typed confirmation.
- [x] Apply spacing, density, semantic color, typography, timestamp, icon, button, skeleton,
  feedback, transition, and reduced-motion rules.
- Acceptance: no arbitrary Unicode icons; critical red is not used for private/neutral state;
  meaningful metadata is at least 12px.

### Phase 5 — verification and delivery

- [x] Full typecheck, build, lint, and relevant/full tests pass.
- [x] Keyboard-only, focus restoration, Escape, palette semantics, and reduced motion verified
  with DOM-level palette/assignment-dialog tests and architecture regressions.
- [ ] Authenticated read-only browser verification at 320, 390, 768, 1024, and wide desktop
  without live mutations, if a reusable authenticated session exists.
- [x] Honest preview empty state verified on all 14 routes at 320, 390, 768, 1024, and 1440;
  70 route/viewport screenshots plus the focused npm configuration state are stored outside the
  repository under `/tmp/watch-premium-screens`.
- [x] Final PR body and ready-state update were attempted after every non-human-gated criterion
  passed. GitHub returned 403; the exact body is handed to the parent for the external update.

## Verification matrix

| Dimension | Cases | Evidence required |
| --- | --- | --- |
| Role | admin, member | route visibility, disabled/read-only copy, command groups |
| Plan | Trial, Solo, Team, ended | plan locks, 402 handling, existing-alert ended exception |
| Data | loading, error, empty, clear, active incident, partial dataset | no false safe state; stable skeleton geometry |
| Network | 401, 402, 403, suspended GitHub, retryable 5xx | preserved response copy and retry behavior |
| Viewport | 320, 390, 768, 1024, 1440+ | no clipping; 48px mobile targets; list→detail, not three panes |
| Keyboard | Tab/Shift+Tab, Enter/Space, Escape, arrows, J/K, Home/End, Cmd/Ctrl+K | visible focus, wrap, active item, close/restore |
| Screen reader | landmarks, headings, labels/descriptions, dialog titles, live regions, chart table | coherent names/state announcements |
| Motion | default, reduced motion | 120–180ms only; reduced-motion removes nonessential movement |

## Explicit non-goals

- No new product API, mutation, role, billing plan, or inferred capability.
- No runtime mock tenant/prospect/scan data and no live Neon writes for visual verification.
- No homepage Ember usage changes, homepage redesign, or signed-out authentication redesign
  beyond preserving coherence.
- No paid resources, Stripe/Resend/Railway setup, domains, Cloudflare named tunnels, or permission
  escalation. Never request GitHub Administration or Workflows write.
- No merge/close of `EmotiveImpact/nospoilers-throwaway` PR #1 and no merge of this PR.

## Human-gated items

- A stable production domain, production credentials, and paid-resource provisioning.
- Final usability/taste sign-off by a human using representative customer data.
- Any authenticated live-install visual check when no reusable read-only browser session is
  available. This must be reported as unverified, not simulated.
- Screen-reader product review by a human assistive-technology user; automated semantics and
  keyboard checks can pass independently.
- Applying the final PR body/ready state with a GitHub credential that can update PR #13; this
  run's token receives `403 Resource not accessible by personal access token`.

## Delivery status

- [x] Feature branch created from current `main`.
- [x] Plan committed as the execution contract.
- [x] Implementation commits pushed.
- [x] Draft PR opened against `main`: https://github.com/EmotiveImpact/nospoilers/pull/13.
- [x] Full automated verification green: 65 files and 489 tests pass; typecheck/build pass; full
  lint exits zero with four pre-existing warnings outside this change.
- [x] Browser/visual evidence recaptured under `/tmp/watch-premium-final-screens` (70 PNGs);
  the PR integration does not support uploading local binary artifacts.
- [x] Non-human-gated acceptance complete.

## Execution record and open engineering work

- `WatchPage.tsx` is a 19-line lazy boundary and `WatchWorkspace.tsx` is a five-line
  controller-composition boundary. All 14 routes now render through focused screen modules.
- Shared domain records live in `src/watch/types.ts`; data loading, capabilities, typed
  confirmation commands, and screen composition live in controller/API/state modules rather
  than either page file.
- The source route now keeps its normal empty/list view free of configuration walls and exposes
  exactly one URL-backed configuration section after a GitHub/npm/site/map choice.
- Notification configuration exposes one selected destination/route flow at a time. The
  Registries route is limited to encrypted credential/list management; npm package identity
  tooling remains on the npm source path.
- Automated DOM tests cover combobox/listbox semantics, wrapped Home/End/Arrow navigation,
  dialog naming, focus trap, Escape, and focus restoration. Architecture tests prevent route
  markup, raw disclosures, microtext, and Unicode controls from returning to the page boundary.
- `/api/me` reported no authenticated user, so live-install read-only visual verification was not
  available. Preview verification used no invented rows and made no live mutations.
- Updating PR #13 and marking it ready was attempted after verification and failed with GitHub
  403. The exact final body and artifact path are included in the handoff for the parent.

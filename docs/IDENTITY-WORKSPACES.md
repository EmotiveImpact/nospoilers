# Identity, workspaces and source connections

Latest (089): one-use connection intents preserve the selected destination across a future GitHub handoff, bound to the same live session and rechecked organisation/workspace authority. This is an internal primitive, not an exposed setup flow. GitHub's accessible-installations response is repository-access evidence, NOT installation-admin evidence; fresh binding requires a separate verified installation-management action/authority plus webhook/callback coordination. Paginated repository inventory is now available for the later reconciliation step. Never grant product workspace membership just because GitHub lists an installation.

Latest (088): billing API routing uses the source's current organisation with organisation administrator authority, including personal organisation billing. Job source references no longer require a separate billing account; immutable payer snapshots still govern usage. Workspaces share their organisation's subscription and allowance. Fresh registration still needs session-bound intent and webhook/setup/resync coordination; this checkpoint does not permit moving populated sources. Earlier source billing-routing limitations below are superseded.

Migration 087 adds immutable job payer columns, separate from source installation. Independent artifact work now records its actual lack of a source connection while retaining the workspace's billing owner. This prevents actor-based concurrency bypass and makes retries/refunds follow the original payer. Remaining source APIs and GitHub installation setup still use legacy billing assumptions; do not expose cross-organisation attachment until that cutover and webhook verification are complete.

Implementation checkpoint (migration 086): source evidence reads use effective explicit workspace membership, with legacy membership retained only as transitional fallback; revoked memberships and archived write restrictions are enforced. This is not full connection ownership migration. Fresh installation webhook handling still creates its billing organisation before setup completion, and billing queries still rely on installation/account identity. Introduce a deliberate source-to-billing-account binding before enabling fresh GitHub attachment into an existing independent organisation; do not merge tenants or present the unused-source mover as this feature. Auth provider selection remains deferred.

Owner-confirmed lifecycle: disconnect retains evidence. A person's account closure is not organisation-history deletion authorisation; shared history needs explicit owner authority and typed confirmation. See DATA-LIFECYCLE-POLICY.md; older pending-retention notes are superseded.

5 September 2026. Approved direction: separate product identity from GitHub source access. Provider choice and commercial limits below are proposals, not shipped functionality.

## Model

Current local implementation through `080`: personal organisation checkout/portal and signed webhook updates preserve the existing shared user entitlement and original trial. No synthetic GitHub installation is created. An unused source can be explicitly placed in another workspace of its existing organisation with full authority checks; source login no longer grants access afterward. Populated connections and cross-organisation moves are rejected. This is an additive transition, not completion of workspace-first resource ownership or multi-provider sign-in.

Latest implementation: migrations 076–077 retain organisation-owned billing independently of GitHub and separate billing mutations from source administrator privileges. Connection selection supports multiple mappings inside one workspace. New attachment/reassignment and personal billing remain open. GitHub uninstall is locally a retained inactive connection; the owner was asked to confirm retention vs separate data deletion before release, as old public copy promises deletion on uninstall.

Implementation checkpoint: migration `075_organization_ownership` now supplies independent organisation administration, owner safeguards and audited role changes. Workspace membership does not automatically confer organisation administration. Invitations currently bind existing internal accounts; provider selection remains deferred. Billing-storage and connection/resource migration are not yet complete.

Account (person) → billing organisation → workspace memberships → workspace sources, scans, releases and alerts.

- A person signs into NoSpoilers using verified email, Google, Microsoft or GitHub; enterprise SSO follows. Gmail/Hotmail are email addresses, not a reason to require a second GitHub login. Select and configure an identity provider before implementing these methods.
- Link identities to one stable internal user ID with explicit authenticated linking and reauthentication. Never merge accounts solely because provider email strings match. Organisation membership comes from invitation/approved provisioning, not an email-domain guess.
- A billing organisation owns the subscription and workspaces. A workspace is a permission, evidence and policy boundary, not a GitHub account, repository or npm monorepo. Membership can differ per workspace; billing ownership does not silently grant repository actions.
- Connect GitHub through an authorised GitHub App installation. Record installation ID, owning GitHub organisation/account, selected repositories, permissions and connection health. One workspace may have multiple approved installations; each connection has an explicit workspace owner. Do not automatically share one installation across unrelated tenants.
- Different people may authorise different GitHub organisations/accounts. Do not pool personal access tokens or switch the NoSpoilers session to impersonate the connector. Reauthenticate with the correct GitHub account when needed for installation/approval; routine scans use installation access.
- Invite teammates and assign NoSpoilers alerts by internal membership ID regardless of sign-in provider. GitHub-side user actions separately require the corresponding GitHub permission. Removing a teammate revokes product access without erasing historic actor attribution or breaking an organisation-owned installation.
- Package-only and website-only workspaces do not need GitHub. Workspace switching changes every query, permission, mutation, count and result selection; clear previous data while switching and keep the scope in the URL.

GitHub supports installation access independently of interactive user access: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps

## Proposed packaging — not yet enforced or advertised

Solo: one seat and 2 workspaces. Team: 5 workspaces, seats priced separately. Enterprise: contract-based workspace allowance; 20 is a starting proposal, not a hard product ceiling. A workspace can contain multiple sources; do not charge one workspace per repository.

Enforce workspace creation atomically at the billing-organisation level. Usage, storage and trial eligibility remain subscription/account-scoped so creating workspaces cannot multiply free scans or restart trials. Invitations do not reset trials. On downgrade, preserve evidence and offer archive/export or upgrade; never delete excess workspaces automatically. Archived workspace semantics and retention must be agreed before implementing cap accounting.

## Migration and Gate B dependency

Current continuation: `074_workspace_membership` adds explicit invitations, acceptance, revocation, role changes, last-owner guards and access events, with real Team & access/inbox UI. Invitations bind to an existing internal account ID, not an unverified email; new-provider/email onboarding remains deferred. Explicit memberships own artifact evidence independently. Legacy source authorization and subscription-owner cutover still need completion; see the current Gate B tracker rather than older checkpoint paragraphs below.

Owner clarification, 5 September: include the independent workspace migration in Gate B now; choose the auth provider later. Additive migrations 071–073 implement the foundation, authenticated workspace management and immutable upload workspace/billing ownership. Creation and switching are integrated and browser verified with a real local fixture upload. Additional workspaces share the existing subscription quota. Connection authorization remains installation-based during this transition; independent membership mutation and remaining resource ownership cutover are still required. Artifact-only new workspaces do not complete the migration.

Current production still uses GitHub sign-in, installation membership/billing and personal uploaded records. `072_workspace_management` adds real create/rename/archive/restore APIs, organisation-level allowances and operation events. Defaults of 2 (5 for existing Team organisations) are provisional, not published plan terms. These APIs do not yet migrate resource ownership or provide the final switcher/member UI. Mockup switching is not evidence of that cutover. New workspaces copy no source connection and create no trial or scan-usage allowance; migrated defaults/connected workspaces remain non-archivable during transition.

1. Gate B now: preserve existing working flows, label scope honestly, test URL selection and unavailable/permission states, and use the approved master-flow design with Mock 3 release-detail components.
2. Foundation B0: introduce stable users and linked identities, billing organisations, workspaces, memberships and installation-to-workspace connections. Backfill existing installation and personal ownership without losing evidence, billing, audit attribution or access. Decide migration mapping explicitly; never infer that all installations sharing an email belong to one tenant.
3. Add scope-first APIs and server enforcement for every resource; test two organisations, mixed roles, invitation expiry, removal, connection revocation, multiple installations, last-owner protection and concurrent workspace limits.
4. Implement provider login/link/recovery, invitation onboarding, workspace switch/create/archive and source connection chooser. Retain legacy URLs through authorised resolution; new stable workspace IDs must survive refresh and back/forward.
5. Finish B1–B8 against these contracts. Mockups may demonstrate planned workspace states but must label them; production must not expose pretend Add workspace, Google/Microsoft sign-in or SSO controls.

No provider signup, paid service, billing limit, tenant migration or deployment is authorised merely by this design note. No local Docker; hosted-worker deployment remains deferred.

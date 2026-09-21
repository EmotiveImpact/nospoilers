# Authentication, enterprise access and scan workers

This is the short, current explanation of how NoSpoilers accounts, GitHub connections, enterprise identity and scan execution fit together.

## The decision

NoSpoilers does **not** need to switch the whole product to WorkOS.

- **Neon Managed Better Auth** is the selected core login service for ordinary customer accounts: email/password first, with social login where useful.
- **GitHub is a source connection**, not the customer account database. A person signs into NoSpoilers, then connects one or more authorised GitHub accounts or organisations to a chosen workspace.
- **WorkOS is a later enterprise extension** for companies that require SAML/OIDC SSO or Directory Sync/SCIM. It will map into the same internal people, organisations and workspaces; it will not replace Neon Postgres or the product authorization model.

Neon Auth is selected but **not live yet**. The fresh Marketplace Neon account must have its owner email verified before its Auth endpoint can be enabled and tested.

## Account and connection model

```text
Person
  └─ trusted sign-in identity (Neon Auth selected; WorkOS enterprise later)
      └─ stable NoSpoilers user ID
          ├─ organisation membership
          ├─ workspace membership and role
          └─ explicit source connections
              ├─ GitHub account / GitHub App installation
              ├─ package registry
              └─ production website
```

The database maps a trusted provider's immutable `(issuer, subject)` pair to one stable internal user ID. Email addresses and display names never merge accounts. This matters when two providers report the same email, an employee changes email, or one person manages several GitHub accounts.

GitHub access tokens and account metadata live in the separate `github_connector_accounts` table. Removing GitHub access clears that connector without signing an email/SSO user out of NoSpoilers. Existing GitHub-only accounts retain their historic user IDs and sign-out behavior during the transition.

## Multiple GitHub accounts

A NoSpoilers login and a GitHub login are separate decisions. A user can eventually:

1. sign into NoSpoilers with email, Google, Microsoft or an enterprise identity;
2. open a workspace;
3. choose **Connect GitHub**;
4. authenticate with the GitHub account that controls the required installation;
5. bind that installation to the selected workspace after NoSpoilers rechecks authority.

Changing the connected GitHub account must not replace the NoSpoilers session or silently move repositories between workspaces. Repository access never grants product membership by itself.

## Enterprise SSO and SCIM

WorkOS becomes useful when a real enterprise customer requires company-managed authentication:

- **SSO** lets the company's identity provider authenticate its employees through SAML or OIDC.
- **SSO enforcement** can require members of that organisation to use the approved company connection.
- **SCIM / Directory Sync** can create, suspend and update organisation memberships when staff join, change role or leave.
- **Session revocation** must remove product and API access immediately after suspension.

These controls belong to a NoSpoilers organisation. They do not grant GitHub repository access and they do not infer membership from an email domain. The first usable collaboration model remains named invitations with explicit roles. Domain-wide or agency-wide delegation is deferred.

Adding WorkOS later is an adapter integration rather than an account migration because provider-neutral identity mapping is already present.

## Internal admin and marketing tools

Artifact Leads, Disclosure Desk and the internal prospect/campaign data remain private operator tools at `/internal/prospects`. They are not enterprise customer features.

- Owner access can bind to the stable `ADMIN_USER_ID`.
- `ADMIN_TOKEN` remains an emergency/operator credential.
- `ADMIN_GITHUB_LOGIN` remains a transition fallback while GitHub-only sign-in exists.
- Customer organisation owners and administrators do not receive internal operator access.
- No outreach is automatically sent and no private customer evidence enters marketing data.

## How scans run

NoSpoilers does not create a permanently running worker for every customer.

```text
Vercel web/API
      │
      ▼
Shared Neon Postgres queue
      │
      ▼
Railway coordinator
      │ one fresh environment per scan
      ▼
Ephemeral Vercel Sandbox microVM
```

The Railway service coordinates trusted jobs. Each untrusted artifact is processed in a fresh, temporary Vercel Sandbox microVM with deny-all networking, bounded files and time, separate staging/parser users and no database, GitHub or control-plane credentials forwarded into it. The sandbox is stopped after success or failure.

Tenant authorization and evidence remain workspace-scoped in the shared application database. A dedicated worker, regional deployment, private networking or customer-managed keys can be considered as a separately priced enterprise option when a customer has a concrete requirement. It is not the default architecture.

## What is implemented

- Migration `123_product_identity` adds provider-neutral sign-in identity mappings.
- GitHub credentials are separated from person records.
- Existing GitHub users retain their user IDs, workspaces and evidence.
- Identity and connector conflicts fail instead of moving ownership.
- GitHub revocation preserves provider-neutral product sessions.
- Internal owner access supports stable `ADMIN_USER_ID`.
- Vercel and Railway have been verified to target the same fresh Neon database.
- Railway can dispatch a clean scan into a fresh, digest-pinned Vercel Sandbox.
- Final source verification passed 1,660 tests across 271 files, typecheck, frontend/API builds and lint with the existing warnings.

## What remains

1. Verify the owner email for the fresh Neon Marketplace account.
2. Enable Neon Managed Better Auth and record its Auth base URL.
3. Configure production and local trusted domains/callbacks.
4. Mount the exact-version-pinned Neon server adapter and add the customer sign-in/recovery UI.
5. Prove email sign-up → session → workspace → GitHub connection → worker scan → saved result on the hosted product.
6. Run the remaining hostile-input, denied-egress and interrupted-sandbox acceptance checks.
7. Add WorkOS only when an enterprise SSO/SCIM requirement is real or explicitly prioritised.

Stripe remains deliberately deferred by the owner and is independent of this authentication work.

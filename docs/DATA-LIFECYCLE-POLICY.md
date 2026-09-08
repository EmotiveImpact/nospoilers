# Approved data lifecycle and deletion authorisation

Owner-approved, 5 September 2026. This supersedes earlier pending-retention notes in the Gate B handoff, architecture and security documents.

## Approved behaviour

- Disconnect GitHub: stop monitoring, revoke scan-token access, retain previous scans/findings/receipts for authorised workspace members. Do not cancel billing or delete history.
- Subscription cancellation: a billing action, not authorisation to erase evidence.
- Archive workspace: preserve evidence; prevent new work according to the existing archive rules.
- Permanent history deletion: a distinct owner-authorised action with explicit affected scope, a typed confirmation and an unambiguous description of consequences.
- Account closure: never implicitly authorises history deletion. Personal identity closure must be distinguished from organisation closure; one member cannot erase the shared team's evidence. Organisation closure with history deletion requires separate explicit acknowledgement and typed confirmation.

Typed confirmation verifies intent; it does not transfer all responsibility to a customer, override other members' rights, or bypass retention obligations/legal holds.

## Implementation boundary

The review form now loads a scoped, owner-authorised current impact inventory (records, active work, connections and published links) before enabling consent. This is not a guaranteed future purge inventory, legal-hold clearance or backup-erasure commitment. Published uploaded-proof links can now be revoked independently; revocation does not retract copies already saved.

Disconnection already retains inactive history. The current Gate B follow-up implements a persisted **deletion review request**, not a purge or completed account closure. The interface must say so clearly. No support notification may be claimed unless delivery exists.

Permanent execution remains a separate controlled workflow. Before enabling it, implement and verify:

1. Recent authentication, exact owner/scope authorisation and a server-generated impact preview.
2. Explicit confirmation for history loss separately from account closure; retain the recorded authorisation.
3. Legal-hold and retention checks, shared ownership handling and any required ownership transfer.
4. Stop active work, revoke relevant access/public proof links, and perform scoped deletion without breaking unrelated workspaces, billing or audit obligations.
5. Recoverable cancellation before execution where supported; idempotent processing and honest pending/failed/completed states.
6. Document backup and third-party retention limitations. Do not promise immediate universal erasure.

Do not disable append-only guards or run destructive SQL merely because a request was submitted. No existing history is authorised for deletion by the owner's general approval of this product policy.

# Agent evidence tools

Implemented on the Release Assurance feature branch; not a provider activation or production-readiness claim.

## Customer workflow

1. Open a recorded release in an explicitly named release stream.
2. As a workspace administrator, expand **Agent tools · explicit access**. Read the data disclosure, name the agent, choose read-only access or draft-note proposals, and confirm.
3. Copy the short-lived credential into the MCP client's secure environment as `NOSPOILERS_AGENT_TOKEN`. It is displayed once and only its hash is stored. Do not put it in prompts, repository files or logs.
4. Configure that client's stdio command as `nospoilers mcp --api https://YOUR-APPLICATION-ORIGIN`. When running this checkout instead of an installed CLI, use `node --import tsx src/cli.ts mcp --api https://YOUR-APPLICATION-ORIGIN` with this repository as the working directory. Avoid wrappers that print command banners to stdout.
5. Review drafts under **Agent drafts and human reviews**. Editing clears confirmation. Accepting records only the reviewed investigation note; it never approves a release, verifies a fix or closes an alert.
6. Revoke access from the same panel. Already received data cannot be recalled from another system. Existing drafts remain available for explicit human review/rejection; revocation prevents further tool calls, not deletion of history.

## Scope and limits

- One explicit stream, including its retained signed metadata and human remediation context. This is not permission to read every workspace or repository.
- Seven fixed tools: `list_releases`, `get_release_status`, `get_release_evidence`, `compare_releases`, `get_release_anomalies`, `prepare_remediation_context`, `propose_remediation_note`.
- Read-only by default. The only optional write is a pending draft note. No model can mint a receipt, adopt policy, merge, deploy, execute files or use discovered credentials.
- Grants last 24 hours and allow 100 calls, at most 20 per minute; at most five unexpired/unrevoked grants per stream. Failed dispatched calls consume budget. A fresh grant requires a new explicit confirmation.
- Current administrator, billing, workspace, source and connection-generation authority is checked on each call and again before returning results. Disconnect/reconnect does not restore an old connected-source grant. Revocation remains available after coverage expiry where administrator/source read authority remains.
- Responses are capped at 512,000 bytes; evidence lists at 200 manifest entries and 100 findings, with explicit totals/truncation. Release discovery returns at most 30 snapshots. Other historical windows retain their existing bounded service contracts.
- HTTP request metadata is limited to 16 KiB. Calls carry a 20-second abort deadline. Database cancellation is cooperative: in-flight database work may finish, but results after cancellation are discarded. A cancellation racing a committed proposal can leave a pending draft, never an applied remediation change. Recent call outcomes are auditable; an interrupted process can leave a `started` record, not a false success.
- The stdio process accepts at most 512 requests and four simultaneous tool calls. Malformed/oversized frames and unknown methods do not invoke evidence tools. Token and upstream error contents are not echoed into protocol errors.
- Grant identity/revocation, submitted draft identity, completed human review and completed call outcomes are update-protected. Retention deletion cascades from original records; these are not perpetual archives.

## Data and provider boundary

Evidence paths, findings and human notes are untrusted data even when their receipt is valid. Tool descriptions are fixed code, not derived from artifact text. Returned text cannot grant authority. Consumers must not follow embedded links or instructions automatically. Raw file bodies and discovered secret values are not tool inputs; only the existing bounded evidence projection is exposed.

NoSpoilers makes no model calls in this increment. The customer's chosen coding-agent client may send the explicitly shared metadata to its own provider and incur its own charges. Local API call budgets are not a promise to cap that provider's spending. There is no MCP sampling capability, remote MCP OAuth endpoint, autonomous investigation or provider-backed explanation service here. Those remain separate opt-in work, including provider contracts/evaluations and cost controls before activation.

## Protocol references

Primary MCP specification, researched 9 September 2026, protocol version `2025-11-25`:

- [Lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle): initialization, capability negotiation and initialized notification.
- [Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports): newline-delimited JSON-RPC over stdio; stdout is protocol-only.
- [Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): stdio environment credentials are distinct from the HTTP authorization framework.
- [Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools): fixed schemas, tool results and human oversight; annotations are not a security boundary.
- [Cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation): cancelling active requests without treating cancellation as success.

The application-specific `/api/release-intelligence/agent-tools` gateway is **not** advertised as an MCP HTTP transport. The stdio adapter calls it with a dedicated `nsa_` credential. Existing session and scan-token endpoints retain their own permissions.

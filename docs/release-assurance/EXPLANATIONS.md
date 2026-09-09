# Optional release explanations

This feature is separate from deterministic evidence and the existing MCP tools. Production composition does not configure an explanation provider. An unavailable provider is shown honestly; there is no generated demo fallback.

## Customer flow

From a selected recorded release, an administrator opens **Optional explanation**. The panel shows exactly which aggregate states/counts would be shared, the configured provider and reserved cost ceilings. A confirmed request is tied to that provider configuration and saved snapshot. A configuration change requires fresh consent.

The returned text is an untrusted draft. A person may edit and accept it as explanatory text, or reject it. Neither action changes a receipt, scan verdict, reference, gate, alert or remediation determination. This is aggregate interpretation, not finding-level root-cause analysis or provider-attested provenance.

## Data boundary

The adapter receives a fixed structured projection of aggregate scan states/counts, not a user-authored prompt. No raw files, paths, titles, credentials, digests, workspace names, identities or human investigation notes are included. Returned text is bounded and rendered as plain text, never executable HTML or an automatic action.

The retained draft and human review stay under workspace/snapshot authorization and the original evidence's deletion lifecycle. An explanation is not independent proof. Provider failure details are not exposed to customers as raw exception text.

## Provider contract and activation

The API composition accepts an explicit operator-supplied adapter; environment credentials do not auto-enable one. An adapter must declare a model, currency, per-call cost ceiling, daily workspace ceiling and output-token ceiling, honor cancellation and enforce its advertised bounds. Reservations are conservative limits, not measured provider bills. A future concrete provider integration requires owner approval, provider-specific evaluation and verified charge/output behavior before activation.

Workspace-level reservations prevent creating streams from multiplying the daily allowance. Failed or cancelled requests retain their reservation because upstream work can still cost money. Idempotent request IDs prevent retries dispatching the same request twice. Cancellation stops accepting a late draft; it cannot recall metadata already sent or promise a refund.

## Research basis

Reviewed on 9 September 2026: [MCP cancellation](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation) describes request identity and late-result races. This application's explanation route is ordinary HTTP, not a new MCP transport. [OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) informs structured data separation, least privilege and human review. These controls reduce exposure; they are not a claim that model text is trustworthy.

Exact implementation and verification results belong in BUILD-LOG and ACCEPTANCE. No provider activation, customer-data transmission or live-provider result is implied by local adapter tests.

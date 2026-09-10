# Isolated UI state review

Run from the repository root:

```sh
npx vite --config tests/ui-fixtures/vite.config.ts
```

Open http://127.0.0.1:4351 in the existing Codex browser. This is a labelled QA fixture, not a customer workspace. It renders actual token/audit components with deterministic local responses, no API plugin, no fetch fallback, locally rejected mutations, an API-denial middleware and a same-origin connection policy. It does not simulate successful credential changes. Keep the real signed-in server on4347 running separately.

States: populated token history, read-only token history, populated audit and access rejection. Review token confirmation/cancellation without submitting it. The fixture includes application styles and explicit Tailwind source discovery. It isolates page content; it does not prove signed-in shell or real API behaviour.

The entry lives under tests and is not imported by production. Use `npx tsc -p tests/ui-fixtures/tsconfig.json` for its type check. Do not add these fixtures to customer routes or production entrypoints.

Hosted findings renders two recorded findings with long paths and an exception form. Supporting assurance/history are deliberately unavailable. Finding selection follows the actual URL-change event; mutations remain disabled. This does not model an entire successful hosted-release workflow.

Hosted brief renders the complete read-only brief with an unavailable assessment and blocked receipt. Proof focus is interactive; downloads fail locally. It does not simulate a ready assessment or governance actions.

Ready, review and blocked assessment variants use buildAssuranceView and the existing assurance test snapshots. Blocked uses a legal hold; the underlying passed receipt remains separately labelled. These are QA evidence states, not customer attestations.

### Configured-form visual review — 10 September
Added isolated actual-component production mapping and configured explanation/pending-review fixtures. All writes remain rejected locally; no provider or production setting was activated. In-app browser geometry at390/768/1024/1440 showed matching document width and zero clipped controls for both forms, with one mapping row and expanded aggregate disclosure. Screenshots inspected production at1280/390 and explanation at1440/390, including the mobile review editor. Fixture TypeScript check passed. This proves presentation only, not provider integration, native zoom or spoken screen-reader acceptance.

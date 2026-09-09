# Isolated UI state review

Run from the repository root:

```sh
npx vite --config tests/ui-fixtures/vite.config.ts
```

Open http://127.0.0.1:4351 in the existing Codex browser. This is a labelled QA fixture, not a customer workspace. It renders actual token/audit components with deterministic local responses, no API plugin, no fetch fallback, locally rejected mutations, an API-denial middleware and a same-origin connection policy. It does not simulate successful credential changes. Keep the real signed-in server on4347 running separately.

States: populated token history, read-only token history, populated audit and access rejection. Review token confirmation/cancellation without submitting it. The fixture includes application styles and explicit Tailwind source discovery. It isolates page content; it does not prove signed-in shell or real API behaviour.

The entry lives under tests and is not imported by production. Use `npx tsc -p tests/ui-fixtures/tsconfig.json` for its type check. Do not add these fixtures to customer routes or production entrypoints.

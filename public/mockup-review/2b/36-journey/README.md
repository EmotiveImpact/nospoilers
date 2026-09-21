# NoSpoilers customer journey design · 16 September 2026

Review `gallery.html` for images of all21 screens; `index.html#journey` maps the flow and links every interactive screen. `index.html#welcome` starts the walkthrough. Serve the existing public/mockup-review directory on4350; this is isolated from4347 and the production site.

## Journey
Choose/upload → inspect → understand the result → review a change → check rebuilt bytes → retain evidence → configure follow-up. Returning users start at Overview. Settings support the task instead of dominating onboarding.

## Design rules
- Preserve the NoSpoilers brand/sidebar and title/trial/search arrangement.
- Near-black base, subtle neutral top glow, restrained burgundy on the latest-release hero only.
- Shared 6–7px corners; quiet dividers and grouped rows rather than nested cards.
- Use status color with words: review pink, warning amber, passed green, unknown neutral.
- Keep basic tasks visible. Use task tabs rather than collapsed setup sections.
- Put result scope next to the result: artifact bytes, point in time, production not checked.
- Keep technical detail in evidence; use ordinary language in lists and actions.
- Each screen has a clear primary task and a path back to its related evidence.

## Screen purposes

| Screen | Purpose |
|---|---|
| [First scan](index.html#welcome) | Start with a build, not a settings checklist. |
| [Overview](index.html#overview) | Latest decision, recent evidence and recorded activity. |
| [New scan](index.html#scan) | Choose the exact artifact and a clear destination. |
| [Scan progress](index.html#progress) | Make queued, scanning and complete distinct. |
| [Finding & evidence](index.html#result) | Understand the issue, affected file and next action. |
| [Verify a fix](index.html#rebuild) | Record a reviewed change, then check the rebuilt bytes. |
| [Rebuilt evidence](index.html#verified) | Preserve the original and show the scoped comparison. |
| [Releases](index.html#releases) | Find saved results; failed attempts stay separate. |
| [Coverage](index.html#sources) | Separate connection status from a scan result. |
| [Alerts](index.html#alerts) | Concise response inbox with evidence one click away. |
| [Timeline](index.html#timeline) | Recorded events linked to the release they describe. |
| [Notifications](index.html#notifications) | Configuration, test and delivery are separate states. |
| [Policy & allowlist](index.html#policy) | Short rule groups and an explicit save boundary. |
| [Team & roles](index.html#team) | Named people, explicit roles, workspace scope. |
| [Workspaces](index.html#workspaces) | Keep access, sources and evidence in the right place. |
| [Plan & billing](index.html#billing) | Current coverage and provider availability first. |
| [Retention](index.html#retention) | Explain expiry before changing evidence availability. |
| [Audit log](index.html#audit) | Administrative actions, distinct from release history. |
| [Install health](index.html#health) | Specific states and repair actions; no invented score. |
| [Scan API tokens](index.html#tokens) | Purpose, scope and expiry before credentials. |
| [Private registries](index.html#registries) | Credential configuration is not scan success. |

## Prototype boundaries
All data is illustrative. No API, auth, database, scan, message, GitHub grant, billing change or credential creation occurs. A sample CSV download is local. In-memory interactions reset on reload. The source-picker supports one coherent sample repository. Other saved releases use separate summary dialogs. Rebuild review requires a note, full commit and review confirmation before continuing. Notification delivery is explicitly simulated. Provider configuration and operational acceptance are not inferred.

The Preview state picker demonstrates records, empty workspace, load failure/retry, viewer access and ended coverage. This is design behavior, not production verification. Native-select styling, exhaustive transitions and complete live backend integration remain implementation work after design review.

## Visual sources
Approved local mock30 captured directly in the Codex in-app browser; existing NoSpoilers brand PNGs; Lucide icons rendered from the installed library. Three anchor designs generated with built-in ImageGen and attached reference capture: Overview, Scan, Finding. Prompts specified1440×1024, date16September2026, dark palette, concise primary task, semantic colors, no hidden primary steps, no security guarantees. Images are in assets/*-concept.png. No new external dependencies or images were downloaded.

## Implementation plan after review
1. Adopt the shell/task hierarchy and shared sizing; keep authority logic in existing components.
2. Implement the complete Scan → result → reviewed rebuild path as one batch.
3. Apply list/detail patterns to Releases, Coverage, Alerts and Timeline.
4. Apply visible task tabs and row patterns to administration pages.
5. Verify real operational/provider paths separately; do not infer them from these mocks.

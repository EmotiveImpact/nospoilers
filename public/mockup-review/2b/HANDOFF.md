# Handoff — Watch mockups

Live product status: [`docs/STATUS.md`](../../../docs/STATUS.md).

These files are static comps under `/mockup-review/`. They do not ship Watch data. Always open a
`.html` path. Directory URLs fall through Vercel’s SPA rewrite to the homepage.

## Current spec

[21-stage-linear.html?shot=c](21-stage-linear.html) — Linear view tokens on the content pane only.

| Comp | Meaning |
| --- | --- |
| [21-stage-linear.html](21-stage-linear.html) | Six stage-only recipes. **C is the one to build.** |
| [20-gray-stage.html](20-gray-stage.html) | Gray plate on the work surface (rejected for live) |
| [19-linear-frame.html](19-linear-frame.html) | Frame around the whole desk (earlier live chrome) |
| [2b-full-guided.html](2b-full-guided.html) | Architecture that shipped (monolith sidebar) |

Do not add Google Fonts `<link>` tags or a CSP meta tag. Both break the in-IDE `localhost:3000`
preview iframe.

## Serve

The app Vite on port 3000 already serves `/mockup-review/`. Or:

```bash
node scripts/serve-mockups.mjs
```

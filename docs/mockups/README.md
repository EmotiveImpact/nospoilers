# Watch desk UX mockups

Ten static HTML directions for the logged-in desk, plus a gallery. Design comps only — no
framework, no build step, nothing wired to data, and nothing here ships in the app build.

The prompt that generated these, and the follow-up prompts for narrowing down, are in
[PROMPT.md](PROMPT.md).

## View them

```bash
npx serve docs/mockups -l 3000
# then open http://localhost:3000/
```

Or open `docs/mockups/index.html` directly in a browser. The gallery previews each mockup in an
iframe; over `file://` some browsers block those frames, in which case use the server above.

## What problem these are answering

`src/pages/WatchPage.tsx` is one ~4,000-line component that stacks roughly fifteen panels
vertically with no in-page navigation:

> Repositories · Alerts · Timeline · Retention · Audit log · Team · Install health · Notifications ·
> Production websites · Map custody · npm packages · Scan API · Releases · Allowlist and baseline

Every panel opens with a paragraph before any data. An active critical leak and the retention
dropdown have the same visual weight. Plan gating and admin-only controls are scattered across all
of it, and members see panels with the controls silently removed.

## The ten

| # | Direction | Optimises for | Cost |
| --- | --- | --- | --- |
| [01](01-console-sidebar.html) | Console sidebar | Familiarity; every feature stays addressable | A real router and 14 route components |
| [02](02-command-stream.html) | Command stream | Speed for keyboard-first engineers | Discoverability of anything behind ⌘K |
| [03](03-triage-inbox.html) | Triage inbox | Clearing alerts fast, with real task state | Three panes need width; poor on mobile |
| [04](04-tabbed-desk.html) | Tabbed desk | Smallest diff; unifies 4 source types into one list | Tabs still hide things; no deep linking today |
| [05](05-verdict-first.html) | Verdict first | A plain-language answer; demos and non-engineers | Power users click a lot to reach detail |
| [06](06-repo-drilldown.html) | Repo drill-down | Large installs; per-repo policy scoping | Cross-repo work needs a second surface |
| [07](07-desk-settings-split.html) | Desk / Settings split | Removing ~8 panels from the desk outright | Two navigation models to maintain |
| [08](08-exposure-timeline.html) | Exposure timeline | Proving the product's value in one number | Needs exposure-window data modelled properly |
| [09](09-bento-overview.html) | Bento overview | Whole install at a glance | Tiles must earn their size or it is noise |
| [10](10-guided-setup.html) | Guided setup | First run and trial-to-paid conversion | Only an entry surface; the desk still needs a shape |

## Choosing

They compose. A plausible end state is **07** as the structural move (configuration leaves the
desk), **01** or **04** as the shell, **03** for the alert experience, **05**'s opening sentence at
the top of the overview, and **10** for the first session.

## On the sample content

The content is illustrative but not invented: rule ids, severities, entity fields (sha256 prefixes,
receipt status, exposure duration, install account, coverage labels), and plan names all come from
the real schema and scanner in this repo, so the layouts are honest about how dense each screen
actually gets. Nothing here is a mock API or a fixture the application reads — when a direction is
chosen, it gets built against the real routes.

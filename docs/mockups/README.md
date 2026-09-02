# Watch desk UX mockups

Ten static HTML directions for the logged-in desk, plus a gallery. Design comps only — no
framework, no build step, nothing wired to data, and nothing here ships in the app build.

The prompt that generated these, and the follow-up prompts for narrowing down, are in
[PROMPT.md](PROMPT.md). If you are an agent picking this up, start with [HANDOFF.md](HANDOFF.md).

## View them

```bash
npx serve docs/mockups -l 3000
# then open http://localhost:3000/
```

Or open `docs/mockups/index.html` directly in a browser. The gallery previews each mockup in an
iframe; over `file://` some browsers block those frames, in which case use the server above.

## State presets

Every mockup carries a switcher in a bar at the bottom of the page with five presets:

| Preset | What it exercises |
| --- | --- |
| Trial admin | Full coverage, install admin, one critical alert mid-triage |
| Solo | Team-gated features replaced by upgrade copy, not silently dropped |
| Member | Admin-only writes removed, with a note explaining who can do them |
| Ended | `CoverageLock` over the panels that stop, alerts still resolvable |
| Empty | A brand-new install with nothing connected |

It is pure CSS — five radio inputs before `.app` and a handful of `:checked ~` rules in
`mockup.css`. The markup contract is:

- `.s-trial` / `.s-solo` / `.s-member` / `.s-ended` / `.s-empty` — show only in that preset
- `.has-data` — hide in the Empty preset
- `.admin-only` — hide in the Member preset
- `.team-only` — hide in the Solo preset
- `.lockable` + a `.lockveil` child — the veil covers the panel in the Ended preset

A layout is easy to make look good with one critical alert and full coverage. These presets are
where the layouts actually get judged. Copy for the locked and gated states comes from
`CoverageLock.tsx` and `WatchPage.tsx` rather than being invented.

## What problem these are answering

`src/pages/WatchPage.tsx` is one ~4,000-line component that stacks roughly fifteen panels
vertically with no in-page navigation:

> Repositories · Alerts · Timeline · Retention · Audit log · Team · Install health · Notifications ·
> Production websites · Map custody · npm packages · Scan API · Releases · Allowlist and baseline

Every panel opens with a paragraph before any data. An active critical leak and the retention
dropdown have the same visual weight. Plan gating and admin-only controls are scattered across all
of it, and members see panels with the controls silently removed.

## Built on 01

Five variants keep 01's sidebar console as the chassis and bolt on the strongest part of each other
direction. Borrowed pieces carry a dashed `from 0X` tag in place, so you can see what came from
where. They share `console.css`, which is the 01 shell plus every borrowed component, so these are
real compositions rather than copies.

| # | Variant | Borrows | Best if |
| --- | --- | --- | --- |
| [1E](1e-console-composite.html) | Console composite | 05 verdict · 09 tiles · 08 exposure · 04 sources · 10 steps · 02 palette | You want one screen that answers the question, shows the numbers, and still admits what is not set up |
| [1A](1a-console-verdict-steps.html) | Console + verdict + steps | 05 verdict and folds · 10 steps and coverage ring | The desk should read like a person telling you what to do next |
| [1B](1b-console-charts.html) | Console + charts | 09 tiles, donut, sparkline · 08 gantt and incident spine | You want the numbers that prove the product works on the first screen |
| [1C](1c-console-triage.html) | Console + triage | 03 panes, checklist, thread · 08 exposure clock | Clearing alerts is the daily job |
| [1D](1d-console-sources-settings.html) | Console + sources + settings | 04 unified source list · 07 settings rows | The clutter you most want gone is configuration |

1D ends with an explicit table mapping all fifteen of today's panels to their new home, so nothing
is quietly dropped.

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

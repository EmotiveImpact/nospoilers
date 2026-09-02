# Handoff — watch desk mockups

Branch: `cursor/watch-desk-ux-mockups-71d1` · PR: EmotiveImpact/nospoilers#3

## State

Ten static HTML mockups in this directory plus `index.html` (gallery), `mockup.css` (shared
tokens and the state system), `README.md`, and `PROMPT.md` (the prompt that generates these).

All ten are built and all ten are wired for the five state presets. Nothing in `src/` is touched
and nothing here ships in the app build — `docs/` is outside `public/`.

## Serve them

```bash
npx serve docs/mockups -l 3000   # http://localhost:3000/
```

Open directly over `file://` also works, except the gallery's iframe previews, which some browsers
block from local files.

## The state system

Five radio inputs sit immediately before `.app` in every mockup, and `mockup.css` drives
everything off `:checked ~`. No JavaScript anywhere in this directory, deliberately — these files
must stay openable with nothing installed.

The markup contract:

| Class | Behaviour |
| --- | --- |
| `.s-trial` `.s-solo` `.s-member` `.s-ended` `.s-empty` | Shown only in that preset |
| `.has-data` | Hidden in the Empty preset |
| `.admin-only` | Hidden in the Member preset |
| `.team-only` | Hidden in the Solo preset |
| `.lockable` with a `.lockveil` child | The veil covers the panel in the Ended preset |

Rules to keep if you extend this:

- Presets are mutually exclusive. `Member` implies a paid Team install; `Solo` implies admin. That
  is a simplification for a comp, and it is the right one — five presets that each tell a clear
  story beat a truthful matrix nobody clicks through.
- Elements are visible by default and *hidden* when the preset does not match, rather than the
  reverse. That avoids fighting `display: revert` against elements that need `flex` or `grid`.
- Locked panels are covered, not dimmed, because that is what `src/components/CoverageLock.tsx`
  actually does.

## Copy sources — do not invent new product strings

Real strings were lifted from the app so the gated states read truthfully:

- `src/components/CoverageLock.tsx` — "Hosted coverage is off", "Trial ended. We stop new jobs and
  scans until Solo $29 or Team $99 is active. Repos stay listed. Existing alerts can still be
  acknowledged and resolved."
- `src/pages/WatchPage.tsx` — "Subscribe to Team to keep the install timeline.", "Slack, SIEM, and
  Jira tickets are on Team. Email for Solo waits on Resend.", "An install admin has to change this
  window.", "No routes yet. Destinations without a route still receive every Watch alert.",
  "Nothing on this install yet.", "The first GitHub user to connect this install is admin. Later
  users become members."
- `src/coverage.ts` — coverage labels: `Trial · N days left`, `Solo`, `Team`, `Coverage ended`.
- `src/index.css` — every colour token and both fonts.

Rule ids, severities, and limits come from the table in the root `README.md`.

## Known gaps, in the order worth doing

1. **A visual pass over the five presets on all ten pages** was in flight when this note was
   written. Anything it turned up is either fixed on this branch or listed in the PR. Re-run it
   after any structural edit: the presets are easy to break by adding content without a state
   class, which makes an element show up in all five.
2. **Narrow widths are only spot-checked.** 01 and 09 were verified at 700px. The three-pane
   layout in 03 and the gantt in 08 are the likely problems.
3. **No mockup shows the loading or per-section error states.** The real desk has both, and 03's
   detail pane and 08's chart are where they would hurt most.
4. **The gallery previews the Trial admin state only.** Showing each card in its Ended state would
   arguably sell the comparison better.

## What this is for

The user picks numbers, then the chosen combination gets built for real in `src/` against the
existing API routes — no mock data, no fixtures. The likely shape is 07 (configuration leaves the
desk) as the structural move, 01 or 04 as the shell, 03 for alerts, 05's opening sentence at the
top of the overview, and 10 for the first session. Splitting `WatchPage.tsx` into route-level
components is the first real task in that build, and it is worth doing whichever direction wins.

# Handoff — watch desk mockups

Branch: `cursor/watch-desk-ux-mockups-71d1` · PR: EmotiveImpact/nospoilers#3

## State

Ten static HTML mockups, five `1x-` static variants built on 01, four earlier click-through studies
(`1f`–`1i`), and the four complete decision mocks (`2a`–`2d`) that you operate with radios and
labels. Gallery is `index.html`. Styles:
`mockup.css` (tokens and the state system), `console.css` (the 01 shell plus borrowed components),
`click.css` (routes, alerts, overlays, scenes), and `combined.css` (the four decision-set
architectures). `README.md` and `PROMPT.md` are the brief.

All fifteen are wired for the five state presets. Nothing in `src/` is touched and nothing here
ships in the app build — `docs/` is outside `public/`.

The user picked **01** as the base, then asked for combinations that *function* so they can click
through. `1e` is the static composite; **`1f` is that composite with every route and the alert
lifecycle wired**. `1g` is the first hour, `1h` is acknowledge → resolve, `1i` is 07 as a working
desk/settings split. New 01-based work should link `console.css` and `click.css` rather than
copying shell or click-through styles. Tag borrowed pieces with
`<span class="added">from 0X</span>` so the provenance stays visible.

The user later correctly pointed out that the gallery did not make a fair decision possible:
`1G` was only first session, `1H` only incident response, and `1I` only the split. `2A`–`2D`
therefore all carry the same full `1F` route/state/action scope and differ only in architecture:
Overview-first, Setup-first, Incident-first, and Source-first. They also reflect current `main`
additions that the old comps missed: GitHub-login invites, batch protected-package import,
fair-use state, release size/media type, delivery locations and verification, approval/rejection,
legal hold, and ledger export. Compare `2A`–`2D`; treat everything before them as design evidence.

Do not add `<link>` tags to Google Fonts and do not add a Content-Security-Policy meta tag. Both
break Cursor's in-IDE `localhost:3000` preview, which iframes the port. The system font stack is
the fallback and looks fine.

## Serve them

```bash
node scripts/serve-mockups.mjs   # http://localhost:3000/
```

Use this script, not `npx serve`. Cursor's in-IDE `localhost:3000` tab iframes the port; `serve`
and any Content-Security-Policy on the pages produce a white pane while the same files look fine
on the Desktop tab. The script binds `0.0.0.0:3000`, never redirects, and sends
`Access-Control-Allow-Origin: *`. After changing the server, refresh that tab.

If the IDE preview still will not load, deploy the static folder:

```bash
cd docs/mockups && npx wrangler@4 deploy --temporary
```

`wrangler.jsonc` is assets-only (`html_handling: auto-trailing-slash`). `--temporary` lasts 60
minutes unless the printed claim URL is used. `.assetsignore` keeps `.wrangler` and markdown out
of the upload.

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
| `.hide-ended` | Hidden in the Ended preset, for content a dedicated `.s-ended` block replaces |
| `.lockable` with a `.lockveil` child | The veil covers the panel in the Ended preset |

Click-through extras in `click.css` (1F–1I only):

| Control | Behaviour |
| --- | --- |
| `name="view"` `#v-*` | Sidebar routes. Alert saved views are `v-alerts`, `v-alerts-wait`, `v-alerts-mine`, `v-alerts-done` so they share a radio group with Overview and can actually navigate. |
| `name="alert"` `#a-*` | Selected alert in the inbox |
| `#ack-map` `#res-map` (checkboxes) | Acknowledge / resolve. Classes `.show-map-ack` `.hide-map-res` `.show-both-res` etc. |
| `name="overlay"` `#ov-*` | Palette, plans, add-source, assign. Scrim is `label for="ov-none"`. `#ov-install` is a sidebar dropdown and must **not** dim the page — the scrim sits at z-index 40 and would hide the menu. |
| `name="scene"` / `name="incident"` | Walkthrough steps on 1G / 1H |
| `name="mode"` `#m-desk` `#m-settings` | 1I chrome switch |

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

## Verifying a preset without clicking

A headless screenshot cannot click the switcher, and a browser-driving agent gets it wrong often
enough that you should not trust a negative result from one. Render the state directly instead:

```bash
node -e '
const fs=require("fs");
let h=fs.readFileSync("docs/mockups/09-bento-overview.html","utf8");
h=h.replace(/ id="p-trial" class="stateset" checked/, " id=\"p-trial\" class=\"stateset\"");
h=h.replace(/ id="p-ended" class="stateset"/, " id=\"p-ended\" class=\"stateset\" checked");
fs.writeFileSync("docs/mockups/_tmp.html",h);'
```

Then screenshot `http://localhost:3000/_tmp` and delete the file. Chrome needs
`--host-resolver-rules="MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"` or it
stalls for 40 seconds on the Google Fonts request. The fonts fall back to system sans, which is
fine for checking layout.

## Known gaps, in the order worth doing

1. **The presets are easy to break by adding content without a state class**, which makes an
   element show up in all five. The other trap is adding an `.s-ended` block next to content it
   replaces without marking that content `.hide-ended` — you get both stacked. That bug happened
   twice and was caught by rendering, not by reading the markup.
2. **Narrow widths are only spot-checked.** 01 and 09 were verified at 700px. The three-pane
   layout in 03 and the gantt in 08 are the likely problems.
3. **Loading exists only on 1G scene 3** (job queue + skeletons). Per-section error states are
   still missing. 03's detail pane and 08's chart are where they would hurt most.
4. **The gallery previews the Trial admin state only.** Showing each card in its Ended state would
   arguably sell the comparison better.

## What this is for

The user picks numbers, then the chosen combination gets built for real in `src/` against the
existing API routes — no mock data, no fixtures. The likely shape is 07 (configuration leaves the
desk) as the structural move, 01 or 04 as the shell, 03 for alerts, 05's opening sentence at the
top of the overview, and 10 for the first session. Splitting `WatchPage.tsx` into route-level
components is the first real task in that build, and it is worth doing whichever direction wins.

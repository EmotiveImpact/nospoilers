# The prompt to feed back

Copy everything between the rules. It is written to be pasted cold — it carries enough context that
the agent does not need to have seen this conversation.

---

Read `src/pages/WatchPage.tsx`, `src/pages/ScanPage.tsx`, `src/components/SiteChrome.tsx`, and
`src/index.css` before you write anything, so the mockups reflect the real product rather than a
generic dashboard.

Context: NoSpoilers is a leak-detection product. It watches GitHub repositories for going public
and reads the **packed artifact** customers download — npm tarball, zip, VSIX, wheel, JAR, gem,
Docker/OCI image, APK/IPA, Lambda zip, Electron `app.asar` — looking for source maps,
`sourcesContent`, `.env` files, private keys, high-confidence credentials, packed `.git`, internal
docs, and payload-size jumps. Findings are rule ids like `MAP-002`, `SEC-003`, `DOC-001`,
`SIZE-003`. Credential values are never stored, only paths and rule ids. Plans are Solo $29 and
Team $99 with a 14-day full trial.

The problem: the logged-in watch desk is a single ~4,000-line React component that renders about
fifteen panels stacked vertically with no in-page navigation — Repositories, Alerts, Timeline,
Retention, Audit log, Team, Install health, Notifications, Production websites, Map custody, npm
packages, Scan API, Releases, Allowlist and baseline. Every panel opens with a paragraph of prose
before any data. Operational work (an active leak) and rare configuration (retention window,
Slack webhook) carry identical visual weight. Plan gating and admin-only controls are scattered
through all of it.

Produce **10 distinct static HTML mockups** of what this desk could be, in `docs/mockups/`, plus a
gallery `index.html` that previews all ten and explains the trade-offs of each.

Requirements:

- Plain HTML and CSS. No build step, no framework, no CDN JavaScript. A shared `mockup.css` is
  fine; each mockup gets its own file and opens directly in a browser.
- Reuse the real design tokens from `src/index.css` — `#09090b` ink, `#111113` panel, `#1f1f23`
  line, `#f4f4f5` snow, `#a1a1aa` mute, `#71717a` dim, `#e2453a` danger, Manrope body, Outfit
  display, the grain overlay. These should look like NoSpoilers, not like Bootstrap.
- The ten must be **genuinely different structural answers**, not ten colour variations. Cover at
  least: a persistent sidebar console, a single activity stream with a command palette, a
  two-or-three-pane triage inbox, a tabbed single page, a plain-language verdict page with
  progressive disclosure, a per-repository drill-down, a hard desk-versus-settings split, a
  time-and-exposure-window view, a bento tile grid, and a guided-setup view that only renders what
  is connected.
- Every mockup must handle the states that actually exist: trial, paid Solo versus Team gating,
  coverage ended and locked, admin versus member, empty and loading, and at least one critical
  alert mid-triage.
- Use realistic content drawn from the repo — real rule ids, real severities, real entity fields
  (sha256 prefixes, receipt status, exposure duration, install account), plausible repo and package
  names. No lorem ipsum, and no invented features that the backend cannot support.
- Show density honestly. If a layout would have to hold fourteen sections of settings, show where
  they go rather than quietly dropping them.
- Each file should carry a small corner label with its number and name, linking back to the
  gallery.
- The gallery must state, for each mockup, what it optimises for, what it costs, and when it is the
  right choice — and end with a recommendation for how to combine them.

Do not modify any application source. These are comps for me to choose from. Commit them on a
branch and open a pull request with a walkthrough.

---

## Follow-up prompts once you have picked

**To combine directions:**

> I want 07's desk/settings split as the structure, 01's sidebar as the shell, and 03's alert
> triage pane. Build that combination for real in `src/`, wired to the existing API routes, with no
> mock data. Split `WatchPage.tsx` into route-level components as you go.

**To go deeper on one:**

> Take mockup 05 and produce four more variations of just that direction — different opening
> sentence treatments, different fold behaviour, and one that works on a phone.

**To pressure-test:**

> Show me mockup 04 in the three states I cannot see today: coverage ended and locked, a member
> rather than an admin, and a brand-new install with nothing connected.

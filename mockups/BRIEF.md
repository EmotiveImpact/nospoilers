# NoSpoilers — redesign mockup brief

Build standalone HTML mockups exploring new UI/UX directions for **NoSpoilers**. Each mockup renders
the **same two screens** so directions can be compared 1:1 and one can be chosen for implementation
in the real app (React 19 + Tailwind v4).

Goal: friendlier UX, cleaner UI, effortless feel — for a developer who is anxious about shipping a
leak. Severity must be scannable in under 2 seconds and the next action must always be obvious.

## Product context

NoSpoilers — "No spoilers in production." Secret scanners read git; NoSpoilers reads the **packed
artifact** (npm tarball, zip, VSIX, wheel, JAR, gem, Docker/OCI image, APK/IPA, serverless zip,
Electron asar) and watches GitHub so a private repo going public never goes unnoticed. It is a
GitHub App plus a hosted scanner. Pricing: Solo $29/mo, Team $99/mo, 14-day trial with full
coverage. You pay for coverage, not a scan counter.

## Hard requirements (every file)

1. One self-contained `.html` file. All CSS in a single `<style>` in `<head>`. All JS in a single
   vanilla `<script>` before `</body>`. No frameworks, no external CSS/JS, no external images, no
   fetch calls, no iframes. A Google Fonts `<link>` is allowed but the page must still look right
   with system font fallbacks. Icons: inline SVG only. No emojis anywhere in the UI.
2. Each file contains BOTH screens and a view switcher, plus coverage states on the watch desk:
   - Two top-level screens: `<main data-screen="landing">` and `<main data-screen="watch">`.
   - A fixed, bottom-center switcher pill (`<nav class="mockup-switcher">`) with buttons
     `Landing` / `Watch desk`, and — visible on the watch screen — state buttons
     `Trial` / `Active` / `Ended`.
   - Vanilla JS: view buttons toggle the two screens (use the `hidden` attribute); state buttons
     set `document.body.dataset.coverage = "trial" | "active" | "ended"` and the CSS/JS reacts.
   - Default: Landing screen, trial coverage. Style the switcher to match the direction; keep it
     unobtrusive (small, semi-transparent is fine).
3. Use the shared content below **verbatim** where given. No lorem ipsum, ever.
4. Severity semantics in every direction: critical = red family, warn = amber family,
   pass/clean = green family. Adapt hues to the direction but keep the meaning unmistakable; never
   encode meaning in color alone (pair with label/weight/icon).
5. Responsive from 375px to 1440px. `<meta name="viewport">`. Semantic landmarks (`header`, `nav`,
   `main`, `section`, `footer`). Real `<button>`/`<a>` elements, visible `:focus-visible` styles,
   WCAG AA contrast. Respect `prefers-reduced-motion`.
6. Top-of-file HTML comment: direction number, name, and a 2–3 sentence rationale.
7. `<title>NoSpoilers mockup — NN Direction name</title>`. File must end with `</html>`.

## Shared content

### Chrome (both screens)

Wordmark **NoSpoilers**. Nav links: Product · Watch · Scan · Pricing · Docs.
Landing right side: "Sign in with GitHub" button. Watch right side: account "emotive-impact".

### Landing screen (verbatim copy)

- Eyebrow: `No spoilers in production`
- H1: `We watch GitHub. We read the pack they download.`
- Sub: `Secret scanners read git. That missed Claude Code’s cli.js.map on npm and maps inside a
  public installer. NoSpoilers is a GitHub App: private → public, then the tarball, zip, or asar.
  You pay for coverage on our servers, not a scan counter.`
- CTAs: `Start 14-day trial` (primary) · `Sign in with GitHub` · `Solo $29 · Team $99`
- Note: `Trial is full coverage. When it ends unpaid, we stop jobs and alerts. The CLI on your
  laptop is a bonus. We do not pretend we can DRM it.`
- Product preview: a mini, stylized rendering of THIS direction's watch desk (static, simplified),
  captioned `The logged-in desk during trial. Click through.`
- Three numbered features:
  - `01` **Watch GitHub** — `Publicize, created public, transfer, collaborator, fork. The doorbell
    answers in under a second. You cannot pirate that.`
  - `02` **Read the pack** — `Hosted unpack of npm tgz, zip, Electron asar. Included on the plan,
    fair use, no scan credits. We do not keep the bytes.`
  - `03` **Fail closed in CI** — `npx nospoilers scan ./package.tgz for the build you remember to
    wire. The hosted app is for the release you forget.`
- "What we flag" strip (chips or rows): `MAP-001` Source map in pack · critical · `SEC-001` .env
  file · critical · `SEC-003` Cloud credential · critical · `GIT-001` .git packed in · critical ·
  `DB-001` Database dump · critical · `SRC-001` Raw TypeScript source · warn · `NET-001`
  Private-network URL · warn · `SIZE-002` Payload over 50 MB · warn
- Footer: Privacy · Terms · Retention · Disclosure · Support · Refunds — and the line
  `No spoilers in production.`

### Watch desk screen

Header: eyebrow `Watch desk`, account `emotive-impact`, button `Install on GitHub`, and a coverage
badge + note per state:

- **Trial**: badge `Trial · 11 days left`, note `Full coverage. No card yet.`
- **Active**: badge `Team · Active`
- **Ended**: badge `Coverage ended`, note `The bot is quiet until you subscribe.`, prominent
  `Subscribe — Solo $29 · Team $99` CTA; the desk content stays visible but muted/quiet.

Stat row: `2 repositories` · `1 open alert` · `1 npm package` · `1 website`.

**Repositories**
- `emotive-impact/desktop` — Private — Checked 2 min ago
- `emotive-impact/old-cli` — Public — Went public 9:14 AM (danger treatment)

**Alerts** (each: kind · time · state, title, body, actions `Acknowledge` `Assign` `Resolve`)
1. `Went public` · 9:14 AM · open — **emotive-impact/old-cli flipped to public** —
   `Visibility job finished in 400ms. No pack attached to this event.`
2. `npm pack` · 8:57 AM · open — **@emotive/desktop@2.4.1 failed policy** — findings:
   - `MAP-002` `dist/cli.js.map` · critical · `Source map embeds original source`
   - `SEC-001` `.env` · critical · `.env file in the pack`
   - `SRC-001` `src/auth.ts` · warn · `Raw TypeScript source`
   Rotation checklist: `Rotate the npm token` · `Purge the CDN cache` ·
   `Publish 2.4.2 and deprecate 2.4.1`

In the **Active** state, alert 1 shows as resolved: `resolved by maya · exposed 4 min`.

**npm packages**: `@emotive/desktop` — registry.npmjs.org — latest `2.4.1` — Last scan:
`failed policy` (danger) — button `Scan latest`.

**Production websites**: `https://app.emotive.dev` — Last crawl: `clean` — input placeholder
`https://…` with button `Watch website`.

**Map custody**: `Sentry → emotive/desktop` — Last check: `ok`.

**Notifications**: `Slack #security` · minimum severity `critical`.

## Files

| File | Direction |
| --- | --- |
| `mockups/01-linear-dark.html` | Linear-style dark |
| `mockups/02-geist-mono.html` | Vercel/Geist monochrome |
| `mockups/03-stripe-light.html` | Stripe-style light |
| `mockups/04-primer-devtool.html` | GitHub Primer devtool |
| `mockups/05-terminal.html` | Terminal / CLI |
| `mockups/06-soft-friendly.html` | Soft & approachable |
| `mockups/07-siem-sidebar.html` | SIEM ops console |
| `mockups/08-brutalist.html` | Brutalist |
| `mockups/09-consumer-cards.html` | Consumer SaaS cards |
| `mockups/10-editorial.html` | Editorial / print |
| `mockups/11-glass-gradient.html` | Glassmorphism gradient |
| `mockups/12-swiss-grid.html` | Swiss / International |

`mockups/index.html` (gallery) is built separately — do not create it.

## The 12 directions

### 01 — Linear-style dark
Tokens: bg `#0a0a0b`, panel `#101012`, border `#232326`, text `#e4e4e7`/`#8a8a93`, accent indigo
`#5e6ad2`, critical `#eb5757`, warn `#f2c94c`, pass `#4cb782`. Dense 13–14px type, tight tracking,
1px borders, subtle inner shadows, keyboard hints (`⌘K`), command-palette energy. Mood: focused,
professional. The current design, grown up.

### 02 — Vercel/Geist monochrome
Tokens: pure `#000` bg on watch, `#fff` bg on landing is allowed (pick one and be consistent per
screen), grayscale only + a single red `#ee0000` reserved for critical. Hairline borders
(`#333`/`#eaeaea`), generous whitespace, geometric sans (system stack), big numerals, almost no
radius. Mood: austere, precise.

### 03 — Stripe-style light
Tokens: bg `#f6f9fc`, ink `#0a2540`, muted `#425466`, accent `#635bff` with a subtle
`#635bff → #00d4ff` gradient used sparingly, critical `#df1b41`, warn `#c48f01`, pass `#0e8a5f`.
Rounded-xl cards, soft layered shadows, spacious. Mood: trustworthy fintech polish.

### 04 — GitHub Primer devtool
Tokens: bg `#f6f8fa`, panel `#ffffff`, border `#d1d9e0`, text `#1f2328`/`#59636e`, link/accent
`#0969da`, critical `#d1242f`, warn `#9a6700`, pass `#1a7f37`. Utilitarian tables, status dots,
ui-monospace for data (SHAs, paths, versions), 14px base. Mood: the familiar dev tool you already
trust.

### 05 — Terminal / CLI
Tokens: bg `#0c0c0c`, phosphor `#33ff66` primary text with amber `#ffb000` secondary, dim
`#4d7a5c`, critical bright red `#ff4444` (keep AA on the dark bg). Monospace everything (Google
Font like JetBrains Mono with ui-monospace fallback), ASCII box-drawing frames, `$` prompts,
`[OK]`/`[CRIT]` tags, subtle scanline or cursor blink (respect reduced-motion). Still fully
readable and usable. Mood: hacker, playful.

### 06 — Soft & approachable
Tokens: warm paper bg `#faf7f2`, ink `#1c1917`, muted `#78716c`, accent teal `#0d9488`, critical
softened `#dc2626` on `#fef2f2` pills, warn `#b45309` on `#fffbeb`, pass `#15803d` on `#f0fdf4`.
Rounded-2xl everything, big friendly buttons, reassuring microcopy, simple SVG spot illustrations.
Security without the fear. Mood: calm, kind.

### 07 — SIEM ops console
Tokens: bg `#0d1117`, panel `#161b22`, border `#30363d`, text `#e6edf3`/`#8d96a0`, accent
`#2f81f7`, critical `#f85149`, warn `#d29922`, pass `#3fb950`. Persistent left sidebar (Overview,
Repositories, Alerts, npm packages, Websites, Map custody, Notifications, Settings), dense tables,
status dots, small bar/sparkline visuals. Mood: control room.

### 08 — Brutalist
Tokens: white bg, black text, 3px black borders, hard shadows `4px 4px 0 #000`, critical
`#ff2b2b`, warn `#ffd500` blocks, pass `#00a651`. Huge heavy headings (Archivo Black or system
heavy fallback), uppercase microtype, zero radius, visible grid. Severity is unmissable. Mood:
loud, confident.

### 09 — Consumer SaaS cards
Tokens: light gradient bg (e.g. `#eef2ff → #ffffff`), card white with radius 16–20px and soft
shadow, accent violet `#7c3aed`, critical `#e11d48`, warn `#d97706`, pass `#059669`. Big friendly
empty/clean states ("Everything is clean"), icon chips (inline SVG), generous spacing, rounded
pills. Mood: light, consumer-grade.

### 10 — Editorial / print
Tokens: paper `#f5f1e8`, ink `#111`, hairline rules `#111` at 1px, accent red `#c0341d` used like
an editor's pen. Serif display (Playfair Display or Georgia fallback) for headings, sans or serif
body, numbered sections, findings set as an annotated column with margin notes, drop cap optional.
Mood: a well-set page; crafted, calm.

### 11 — Glassmorphism gradient
Tokens: deep gradient bg (`#0f0c29 → #302b63 → #24243e`), frosted cards `rgba(255,255,255,.06)`
with `backdrop-filter: blur(14px)` and 1px `rgba(255,255,255,.12)` borders, text `#f4f4f8`/
`#b8b8cc`, neon gradient accents (cyan `#22d3ee` → magenta `#e879f9`), critical `#fb7185` with a
soft glow, warn `#fbbf24`, pass `#34d399`. Keep body-text contrast AA despite the glass. Mood:
futuristic, flashy.

### 12 — Swiss / International
Tokens: white bg, black text, international orange-red `#ff4d00` as the single accent, hairline
black rules, Helvetica/Arial, strict 12-column grid, huge numerals, uppercase microtype with wide
tracking, no shadows, no radius. Mood: systematic, rational.

## Quality checklist (verify before finishing)

- Both screens render; switcher works; Trial/Active/Ended change the watch desk visibly.
- Landing copy matches the brief verbatim; severity meaning obvious in under 2 seconds.
- No console errors, no external requests except optional Google Fonts, balanced tags, ends with
  `</html>`.
- 375px and 1440px both look intentional.

import {
  ArrowRight, ArrowUpRight, Bot, Building2, Check, Code2,
  Database, FileCode2, FolderLock, GitFork, Globe2, KeyRound, Menu,
  Package, PackageSearch, Radar, Send,
  Settings2, ShieldAlert, UserRound, UsersRound, X,
  type LucideIcon,
} from "lucide-react"
import { navigate } from "@/nav.ts"
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import "./v20-homepage.css"

export type MarketingSession = { user: { login: string } | null; githubApp: boolean; developmentLogin?: boolean }
type Tab = "all" | "files" | "maps" | "secrets" | "ai" | "manifest"
type Feature = { key: string; title: string; short: string; detail: string; how: string; checks: string; result: string; icon: LucideIcon }

const FEATURES: Feature[] = [
  { key: "maps", title: "Source maps", short: "Detect embedded original source code.", detail: "A release can be clean in Git and still ship a .map containing the original TypeScript or JavaScript source. NoSpoilers reconstructs bounded embedded source in memory and reports the original paths without storing the source.", how: "Bundlers can publish source maps beside minified JavaScript, and some maps embed the original application source in sourcesContent.", checks: "NoSpoilers validates the map, reconstructs bounded embedded source in memory, then scans original paths for private material without persisting reconstructed source.", result: "You see the affected map, original source paths, severity, release coordinate and whether the exposure is new in this release.", icon: FileCode2 },
  { key: "secrets", title: "Secrets & keys", short: "Find API keys, tokens and credentials.", detail: "Build steps can copy environment files, private keys or credentials into the final package even when they were never committed. Findings identify the rule and path but never print the secret value.", how: "Build scripts, copied environment files and packaging rules can move credentials into a release even if those values were never intentionally committed.", checks: "The final artefact is inspected for environment files, private-key material and high-confidence credential patterns. Matched secret values are never shown or stored.", result: "You get the rule, file path, fingerprint and remediation context without turning NoSpoilers into another place that holds the secret.", icon: KeyRound },
  { key: "ai", title: "AI context", short: "Catch prompts, system files and agent data.", detail: "Modern products can accidentally ship system prompts, agent instructions, tool configuration and private AI context. NoSpoilers treats that material as part of the release boundary, not merely source code.", how: "AI-enabled products increasingly package system prompts, agent instructions, tool schemas, memory files and private routing configuration.", checks: "NoSpoilers treats AI context as release exposure and checks the final package for prompt and agent material that should remain internal.", result: "The finding identifies the exposed file and release so the team can remove it or explicitly approve material that is meant to be public.", icon: Bot },
  { key: "internal", title: "Internal files", short: "Identify private docs, configs and routes.", detail: "Documentation, configuration, internal routes and debug artefacts often enter archives after code review. The scanner checks the actual package tree so these additions do not remain invisible.", how: "Documentation, configs, debug files and internal routes can be added during build or packaging after normal repository review has finished.", checks: "NoSpoilers inspects the package tree customers receive, not only the repository tree developers reviewed.", result: "Unexpected internal artefacts appear as explainable findings with exact paths, severity and release history.", icon: FolderLock },
  { key: "content", title: "Unexpected content", short: "Spot anything that should not be public.", detail: "Release Diff makes the package itself auditable. Unexpected files, large additions and material introduced since the last approved release become visible before they surprise you in production.", how: "A release can change shape without a code-review problem: new files, unusually large additions, nested archives or generated material may appear late in the pipeline.", checks: "Release Diff compares the current artefact with an approved baseline and highlights new, removed and materially changed exposure.", result: "Teams can focus on what changed in this release rather than repeatedly reviewing the entire package from scratch.", icon: PackageSearch },
  { key: "live", title: "Live monitoring", short: "Keep watching after deployment.", detail: "Protection continues after publish. NoSpoilers watches releases, GitHub exposure events and verified production origins so the release boundary does not disappear once CI has finished.", how: "A clean build does not guarantee the public deployment stays clean. A later release, repository exposure change or production asset can create risk after CI has finished.", checks: "Watch follows release events, GitHub exposure and verified production origins using the same underlying finding model.", result: "The Watch desk keeps one timeline of what shipped, what became exposed and what the team did about it.", icon: Radar },
]

const FINDINGS = [
  { severity: "Critical", level: "critical", file: "cli.js.map", detail: "Embedded original source (1,842 files)", types: ["maps", "files"] },
  { severity: "Critical", level: "critical", file: "/internal/config.json", detail: "Internal configuration file", types: ["files"] },
  { severity: "High", level: "high", file: ".env", detail: "Environment variables", types: ["secrets", "files"] },
  { severity: "High", level: "high", file: "prompts/system.txt", detail: "AI system prompt detected", types: ["ai", "files"] },
  { severity: "Low", level: "low", file: "docs/architecture.md", detail: "Internal documentation", types: ["files"] },
]

const STAGES = [
  { name: "Code", detail: "Your repository", icon: Code2 },
  { name: "Build", detail: "CI / CD", icon: Settings2 },
  { key: "package", name: "Package", detail: "npm, Docker, etc.", icon: Package },
  { key: "registry", name: "Registry / CDN", detail: "What goes public", icon: Database },
  { key: "production", name: "Production", detail: "Live website / app", icon: Globe2 },
  { key: "delivery", name: "Customer delivery", detail: "What they receive", icon: Send },
]

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export function Brand() { return <span className="v20-brand"><span className="v20-brand-mark" aria-hidden="true" />NoSpoilers</span> }

export function MarketingNav({ me, openApp, home = true }: { me: MarketingSession | null; openApp: () => void; home?: boolean }) {
  const [menu, setMenu] = useState<"product" | "resources" | null>(null)
  const [mobile, setMobile] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const mobileDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = mobileDialog.current
    if (!mobile || !dialog) return
    dialog.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const resized = () => { if (window.innerWidth > 980) setMobile(false) }
    window.addEventListener('resize', resized)
    return () => { dialog.close(); document.body.style.overflow = overflow; window.removeEventListener('resize', resized) }
  }, [mobile])
  useEffect(() => { const update = () => setScrolled(window.scrollY > 14); update(); window.addEventListener("scroll", update, { passive: true }); return () => window.removeEventListener("scroll", update) }, [])
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenu(null); setMobile(false) } }; document.addEventListener("keydown", close); return () => document.removeEventListener("keydown", close) }, [])
  const scan = () => navigate(me?.user ? "/watch/scan" : "/scan")
  return <>
    <header className={`v20-nav${scrolled ? " scrolled" : ""}`}>
      <div className="v20-wrap v20-nav-inner"><a href={home ? "#top" : "/"}><Brand /></a>
        <nav className="v20-nav-links" aria-label="Primary">
          <NavMenu label="Product" open={menu === "product"} setOpen={() => setMenu("product")} hover={() => setMenu("product")} leave={() => setMenu(null)} footer>
            <div className="v20-mega-column"><MenuItem href="/product#inspect" title="Inspect what ships" copy="Find exposure in the bytes your customers receive." /><MenuItem href="/use-cases#websites" title="Monitor the boundary" copy="Follow supported sources after release." /></div>
            <div className="v20-mega-column"><MenuItem href="/use-cases#response" title="Respond with context" copy="Review findings and keep the response together." /><MenuItem href="/product#evidence" title="Keep the evidence" copy="Return to a scoped record of every check." /></div>
            <div className="v20-mega-column v20-mega-quick"><a href="/product">Product overview</a><a href="/use-cases">Use cases</a><a href="/integrations">Integration directory</a><a href="/security">Security</a><a href="/enterprise">For enterprise</a></div>
          </NavMenu>
          <NavMenu label="Resources" open={menu === "resources"} setOpen={() => setMenu("resources")} hover={() => setMenu("resources")} leave={() => setMenu(null)}>
            <div className="v20-mega-column"><MenuItem href="/docs" title="Documentation" copy="Understand the product, one clear guide at a time." /><MenuItem href="/docs/getting-started" title="Get started" copy="From your first package to saved evidence." /></div>
            <div className="v20-mega-column"><MenuItem href="/docs/api-tokens-and-ci" title="API and CI" copy="Bring release checks into your build workflow." /><MenuItem href="/support" title="Get support" copy="Find the next step when something gets stuck." /></div>
            <div className="v20-mega-column v20-mega-quick"><a href="/docs/github">Connect GitHub</a><a href="/docs/supported-inputs">Supported inputs</a><a href="/docs/proof">Release proof</a><a href="/status">Service status</a><a href="/disclosure">Security disclosure</a></div>
          </NavMenu>
          {[["/pricing", "Pricing"], ["/security", "Security"]].map(([href, label]) => <a key={href} className="v20-nav-link" href={href}>{label}</a>)}
          <button className="v20-nav-link" onClick={() => navigate("/docs")}>Docs</button>
        </nav>
        <div className="v20-nav-right"><button className="v20-nav-link" onClick={openApp}>Open app</button>{!me?.user && <button className="v20-nav-link" onClick={openApp}>Log in</button>}<button className="v20-nav-cta" onClick={scan}>Start a scan</button><button className="v20-mobile-menu-button" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>{mobile ? <X /> : <Menu />}</button></div>
      </div>
    </header>
    <dialog ref={mobileDialog} className="v20-mobile-menu" aria-label="Site navigation" onCancel={() => setMobile(false)} onClose={() => setMobile(false)}>
      <div className="v20-mobile-head"><a href="/" onClick={() => setMobile(false)}><Brand /></a><div>{!me?.user && <button className="v20-mobile-login" onClick={() => {setMobile(false);openApp()}}>Log in</button>}<button className="v20-nav-cta" onClick={() => {setMobile(false);scan()}}>Start a scan</button><button autoFocus className="v20-mobile-menu-button" aria-label="Close menu" onClick={() => setMobile(false)}><X /></button></div></div>
      <nav className="v20-mobile-menu-inner" aria-label="Mobile navigation">
        {[
          {title:'Product',links:[['/product#inspect','Inspect what ships'],['/use-cases#websites','Monitor the boundary'],['/use-cases#response','Respond with context'],['/product#evidence','Keep the evidence']]},
          {title:'Explore',links:[['/product','Product overview'],['/use-cases','Use cases'],['/integrations','Integrations'],['/pricing','Pricing'],['/security','Security'],['/enterprise','Enterprise']]},
          {title:'Resources',links:[['/docs','Documentation'],['/docs/getting-started','Get started'],['/docs/api-tokens-and-ci','API and CI'],['/support','Support'],['/status','Service status'],['/disclosure','Security disclosure']]},
        ].map(group=><section key={group.title}><h2>{group.title}</h2>{group.links.map(([href,label])=><a key={href} href={href} onClick={()=>setMobile(false)}>{label}</a>)}</section>)}
      </nav>
    </dialog>
  </>
}

function NavMenu({ label, open, footer, setOpen, hover, leave, children }: { label: string; open: boolean; footer?: boolean; setOpen: () => void; hover: () => void; leave: () => void; children: React.ReactNode }) {
  const id = `v20-menu-${label.toLowerCase()}`;
  return <div className="v20-nav-wrap" onMouseEnter={hover} onMouseLeave={leave} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) leave() }} onKeyDown={(event) => { if(event.key==='Escape'){ leave(); event.currentTarget.querySelector('button')?.focus() } }}><button className={`v20-nav-trigger${open ? " open" : ""}`} aria-expanded={open} aria-controls={id} onClick={setOpen} onKeyDown={(event)=>{if(event.key==='ArrowDown'){event.preventDefault();setOpen();requestAnimationFrame(()=>document.getElementById(id)?.querySelector('a')?.focus())}}}>{label}</button><div id={id} aria-label={`${label} links`} className={`v20-mega${open ? " open" : ""}`} inert={!open}><div className="v20-mega-grid">{children}</div>{footer?<a className="v20-mega-footer" href="/docs/getting-started"><span><b>Start here</b> Your first release check</span><span>Read the guide <ArrowRight aria-hidden="true" /></span></a>:null}</div></div>
}

function MenuItem({ title, copy, href }: { title: string; copy: string; href: string }) {
  return <a href={href}><b>{title}</b><small>{copy}</small></a>
}

function HeroAndSupply({ active, scanning, progress, runScan, scanPath }: { active: string | null; scanning: boolean; progress: string; runScan: () => void; scanPath: string }) {
  const [tab, setTab] = useState<Tab>("all")
  const visible = FINDINGS.filter((row) => tab === "all" || tab === "manifest" || row.types.includes(tab))
  return <>
    <section className="v20-wrap v20-hero" id="product"><div className="v20-hero-copy"><div className="v20-eyebrow">Release exposure protection</div><h1>Git scanners tell you what was written.<span>NoSpoilers tells you what escaped.</span></h1><p>Scan the exact packages and production assets customers receive. Catch source maps, secrets, internal files and AI context before they go public, then keep watching after deploy.</p><div className="v20-hero-actions"><button className="v20-button primary" onClick={() => navigate(scanPath)}>Scan a release&nbsp; →</button><a className="v20-button ghost" href="#supply"><span className="v20-play">▶</span>See how it works</a></div><div className="v20-micro">Choose a file without signing up. Sign in starts the scan and your five-day trial.</div></div>
      <div className="v20-hero-visual"><div className={`v20-product-window${scanning ? " scan-active" : ""}`}><span className="v20-edge-beam" /><div className="v20-product"><aside className="v20-product-side"><Brand />{["Overview", "Coverage", "Releases", "Alerts", "Settings"].map((item, index) => <span key={item} className={`${index === 0 ? "active" : ""}${item === "Alerts" ? " alert" : ""}`}>{item}</span>)}</aside><div className="v20-desk"><div className="v20-crumb">Releases &nbsp;›&nbsp; acme-cli &nbsp;›&nbsp; v2.4.1</div><div className="v20-release-top"><div><h3>v2.4.1 <span>npm</span></h3><small>Published 2 hours ago &nbsp; • &nbsp; 4.2 MB &nbsp; • &nbsp; 1,842 files</small></div><button className="v20-button v20-rescan" disabled={scanning} onClick={runScan}>{scanning ? "Scanning…" : "↻  Rescan"}</button></div><div className={`v20-danger-card${scanning ? " scanning" : ""}`}><div><strong>{scanning ? "Scanning release surface…" : "⚠  5 critical issues found"}</strong><small>{scanning ? "Following the artefact from package to customer delivery." : "Sensitive content detected in published package."}</small></div><a href="#findings">View all issues →</a></div><div className="v20-tabs" role="tablist">{(["all", "files", "maps", "secrets", "ai", "manifest"] as Tab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "all" ? "Findings (17)" : item === "ai" ? "AI context" : item[0].toUpperCase() + item.slice(1)}</button>)}</div><div className="v20-finding-table">{visible.map((row) => <div className="v20-finding" key={row.file}><span className={`v20-severity ${row.level}`}>{row.severity}</span><span>{row.file}</span><span>{row.detail}</span><span>›</span></div>)}</div></div></div></div></div>
    </section>
    <section className="v20-compat"><div className="v20-wrap"><div className="v20-compat-title">Fits alongside the release stack you already use</div><div className="v20-compat-row">{["Vercel", "npm", "GitHub", "Docker", "Cloudflare", "Microsoft", "AWS"].map((name) => <span key={name}>{name}</span>)}</div></div></section>
    <section className="v20-wrap v20-section" id="supply"><div className="v20-section-intro"><div><div className="v20-eyebrow">The release boundary</div><h2>Security does not stop at Git.</h2></div><p>Code review covers what developers wrote. NoSpoilers follows what the build created, what became public, what production serves and what the customer finally receives.</p></div><div className="v20-supply"><div className="v20-supply-title">The modern software supply chain</div><div className="v20-pipeline">{STAGES.map((stage) => { const Icon = stage.icon; return <div key={stage.name} className={`v20-stage${stage.key ? " active" : ""}${active === stage.key ? " scan-step" : ""}`}><span><Icon /></span><div><b>{stage.name}</b><small>{stage.detail}</small></div></div> })}</div><div className={`v20-scan-progress${scanning ? " running" : ""}`}><span /><span>{progress}</span></div><div className="v20-coverage-row"><div>Traditional Git scanners stop here</div><div>NoSpoilers protects what escapes.</div></div></div></section>
  </>
}

function FindingCards({ selected, setSelected }: { selected: Feature | null; setSelected: (feature: Feature | null) => void }) {
  return <><section className="v20-wrap v20-section v20-findings" id="findings"><div><div className="v20-eyebrow">Catch what others miss</div><h2>Real leaks.<br />Real damage.</h2><p>Code review sees the repository. Customers receive the output of your build system, bundler, registry and deployment pipeline. That gap is where private material can escape.</p><p className="secondary">NoSpoilers inspects that final output, tells you exactly what became exposed and keeps watching the release after it goes live.</p><a href="#security">Explore all findings&nbsp; →</a></div><div className="v20-feature-grid">{FEATURES.map((feature) => { const Icon = feature.icon; return <button key={feature.key} className="v20-feature" onClick={() => setSelected(feature)} title={feature.detail}><span><Icon /></span><h3>{feature.title}</h3><p>{feature.short}</p><small>Read more <ArrowUpRight /></small></button> })}</div></section>{selected && <div className="v20-detail-modal" role="dialog" aria-modal="true" aria-labelledby="v20-detail-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div className="v20-detail"><div className="v20-detail-head"><span className="v20-detail-icon"><ShieldAlert /></span><div><div className="v20-eyebrow">Release exposure</div><h3 id="v20-detail-title">{selected.title}</h3></div><button autoFocus aria-label="Close" onClick={() => setSelected(null)}><X /></button></div><div className="v20-detail-body"><p>{selected.detail}</p><div className="v20-detail-grid"><div><b>How it escapes</b><p>{selected.how}</p></div><div><b>What NoSpoilers checks</b><p>{selected.checks}</p></div><div><b>What you get</b><p>{selected.result}</p></div></div><footer><span><b>Same scanner kernel.</b> Final artefact first.</span><span>Esc closes this window</span></footer></div></div></div>}</>
}

function ShipConfidence({ scanPath }: { scanPath: string }) { return <section className="v20-wrap v20-confidence-section" id="security"><div className="v20-confidence"><div className="v20-confidence-copy"><h2>Ship with confidence</h2><p>Scan before release. Keep watching after deploy.</p><div><button className="v20-button primary" onClick={() => navigate(scanPath)}>Start for free&nbsp; →</button><span>No credit card required.</span></div></div><div className="v20-verify"><span><Check /></span><span><b>Release verified</b><small>No sensitive content found.</small></span></div><small className="v20-verify-meta">Release proof · v2.4.1</small></div></section> }

function PricingSection() {
  const [yearly, setYearly] = useState(false)
  const plans = [{ name: "Solo", sub: "For individual developers", month: "$29", year: "$290", icon: UserRound, items: ["All granted repositories", "Release pack monitoring", "Hosted scans, fair use", "Email coverage"] }, { name: "Team", sub: "For small teams", month: "$99", year: "$990", icon: UsersRound, popular: true, items: ["Everything in Solo", "Higher fair-use concurrency", "Team roles", "Audit export & release evidence"] }, { name: "Custom", sub: "For higher-volume organisations", month: "Custom", year: "Custom", icon: Building2, items: ["Everything in Team", "Custom retention", "Higher-volume processing", "Security review support"] }]
  return <section className="v20-wrap v20-section v20-pricing" id="pricing"><div><div className="v20-eyebrow">Simple, transparent pricing</div><h2>Built for developers.<br />Ready for teams.</h2><p>Coverage, not scan credits. Start small and keep your release boundary protected as your team grows.</p></div><div><div className={`v20-billing${yearly ? " yearly" : ""}`}><span /><button className={!yearly ? "active" : ""} onClick={() => setYearly(false)}>Monthly</button><button className={yearly ? "active" : ""} onClick={() => setYearly(true)}>Yearly</button><small>Save 17%</small></div><div className="v20-price-grid">{plans.map((plan) => { const Icon = plan.icon; return <article key={plan.name} className={`v20-price-card${plan.popular ? " popular" : ""}`}>{plan.popular && <span className="v20-popular">Most popular</span>}<div className="v20-plan-top"><span><Icon /></span><div><h3>{plan.name}</h3><small>{plan.sub}</small></div></div><div className="v20-price">{yearly ? plan.year : plan.month} <small>{plan.name === "Custom" ? "/ volume" : `/ ${yearly ? "year" : "month"}`}</small></div><ul>{plan.items.map((item) => <li key={item}>{item}</li>)}</ul>{plan.name === "Custom" ? <a className="v20-button" href="mailto:hello@nospoilers.dev">Contact us</a> : <button className={`v20-button${plan.popular ? " primary" : ""}`} onClick={() => navigate("/pricing")}>Get started</button>}</article> })}</div></div></section>
}

export function MarketingFooter({ home = true }: { home?: boolean }) {
  const columns = [["Product", [["Product", "#product"], ["Coverage", "/watch/sources"], ["New scan", "/scan"], ["Docs", "/docs"], ["Pricing", "#pricing"], ["Status", "/status"]]], ["Legal & support", [["Privacy", "/privacy"], ["Terms", "/terms"], ["Retention", "/retention"], ["Disclosure", "/disclosure"], ["Support", "/support"], ["Refunds", "/refunds"]]]] as const
  function route(event: ReactMouseEvent<HTMLAnchorElement>, href: string) { if (href.startsWith("/")) { event.preventDefault(); navigate(href) } }
  return <footer className="v20-footer"><div className="v20-wrap v20-footer-main"><div className="v20-footer-brand"><Brand /><p>No spoilers in production. Coverage across GitHub exposure, release artefacts and the bytes customers actually receive.</p><a href="https://github.com/EmotiveImpact/nospoilers" aria-label="NoSpoilers on GitHub"><GitFork /></a></div>{columns.map(([heading, items]) => <div key={heading}><h4>{heading}</h4><div>{items.map(([label, href]) => { const target = !home && href.startsWith("#") ? `/${href}` : href; return <a key={label} href={target} onClick={(event) => route(event, target)}>{label}</a> })}</div></div>)}<div><h4>Coverage</h4><div><span>Solo $29 / month</span><span>Team $99 / month</span><span>5-day full trial</span><span>Yearly: 10 months for 12</span><a href={home ? "#security" : "/#security"}>Security & privacy</a></div></div></div><div className="v20-wrap v20-footer-bottom"><span>Scanning and monitoring require active coverage. Existing release proofs can always be verified free.</span><code>nospoilers verify --receipt receipt.json</code></div></footer>
}

export function V20Homepage() {
  const [me, setMe] = useState<MarketingSession | null>(null), [selected, setSelected] = useState<Feature | null>(null), [scanning, setScanning] = useState(false), [active, setActive] = useState<string | null>(null), [progress, setProgress] = useState("Release surface ready")
  useEffect(() => { let cancelled = false; void fetch("/api/me", { credentials: "include" }).then(async (response) => { const body = await response.json() as MarketingSession; if (!cancelled && response.ok) setMe(body) }).catch(() => { if (!cancelled) setMe({ user: null, githubApp: false }) }); return () => { cancelled = true } }, [])
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null) }; document.addEventListener("keydown", close); document.body.style.overflow = selected ? "hidden" : ""; return () => { document.removeEventListener("keydown", close); document.body.style.overflow = "" } }, [selected])
  const openApp = () => { if (me?.user) navigate("/watch"); else if (me?.githubApp) window.location.assign("/api/auth/github"); else navigate("/watch") }
  async function runScan() { if (scanning) return; setScanning(true); for (const [key, label] of [["package", "Inspecting package"], ["registry", "Checking published bytes"], ["production", "Verifying production surface"], ["delivery", "Confirming customer delivery"]]) { setActive(key); setProgress(label); await wait(520) } setActive(null); setProgress("Exposure found in published package"); await wait(620); setScanning(false); setProgress("Release surface checked") }
  const scanPath = me?.user ? "/watch/scan" : "/scan"
  return <div className="v20-home" id="top"><MarketingNav me={me} openApp={openApp} /><main><HeroAndSupply active={active} scanning={scanning} progress={progress} runScan={() => void runScan()} scanPath={scanPath} /><FindingCards selected={selected} setSelected={setSelected} /><ShipConfidence scanPath={scanPath} /><PricingSection /></main><MarketingFooter /></div>
}

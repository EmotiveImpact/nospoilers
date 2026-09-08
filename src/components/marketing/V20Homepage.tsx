import { ArrowRight, GitFork, Menu, X } from "lucide-react"
import { navigate } from "@/nav.ts"
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import "./v20-homepage.css"
import { HomepageD } from "./HomepageD"

export type MarketingSession = { user: { login: string } | null; githubApp: boolean; developmentLogin?: boolean }
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
        <div className="v20-nav-right"><button className="v20-nav-link" onClick={openApp}>{me?.user ? "Back to workspace" : "Log in"}</button><button className="v20-nav-cta" onClick={scan}>Start a scan</button><button className="v20-mobile-menu-button" aria-label="Open menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>{mobile ? <X /> : <Menu />}</button></div>
      </div>
    </header>
    <dialog ref={mobileDialog} className="v20-mobile-menu" aria-label="Site navigation" onCancel={() => setMobile(false)} onClose={() => setMobile(false)}>
      <div className="v20-mobile-head"><a href="/" onClick={() => setMobile(false)}><Brand /></a><div><button className="v20-mobile-login" onClick={() => {setMobile(false);openApp()}}>{me?.user ? "Back to workspace" : "Log in"}</button><button className="v20-nav-cta" onClick={() => {setMobile(false);scan()}}>Start a scan</button><button autoFocus className="v20-mobile-menu-button" aria-label="Close menu" onClick={() => setMobile(false)}><X /></button></div></div>
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

export function MarketingFooter({ home = true }: { home?: boolean }) {
  const columns = [["Product", [["Product", "#product"], ["Coverage", "/watch/sources"], ["New scan", "/scan"], ["Docs", "/docs"], ["Pricing", "#pricing"], ["Status", "/status"]]], ["Legal & support", [["Privacy", "/privacy"], ["Terms", "/terms"], ["Retention", "/retention"], ["Disclosure", "/disclosure"], ["Support", "/support"], ["Refunds", "/refunds"]]]] as const
  function route(event: ReactMouseEvent<HTMLAnchorElement>, href: string) { if (href.startsWith("/")) { event.preventDefault(); navigate(href) } }
  return <footer className="v20-footer"><div className="v20-wrap v20-footer-main"><div className="v20-footer-brand"><Brand /><p>No spoilers in production. Coverage across GitHub exposure, release artefacts and the bytes customers actually receive.</p><a href="https://github.com/EmotiveImpact/nospoilers" aria-label="NoSpoilers on GitHub"><GitFork /></a></div>{columns.map(([heading, items]) => <div key={heading}><h4>{heading}</h4><div>{items.map(([label, href]) => { const target = !home && href.startsWith("#") ? `/${href}` : href; return <a key={label} href={target} onClick={(event) => route(event, target)}>{label}</a> })}</div></div>)}<div><h4>Coverage</h4><div><span>Solo $29 / month</span><span>Team $99 / month</span><span>5-day full trial</span><span>Yearly: 10 months for 12</span><a href={home ? "#security" : "/#security"}>Security & privacy</a></div></div></div><div className="v20-wrap v20-footer-bottom"><span>Scanning and monitoring require active coverage. Existing release proofs can always be verified free.</span><code>nospoilers verify --receipt receipt.json</code></div><div className="v20-wrap v20-footer-bottom"><span>Made With ♦️ in London. An Emotive Impact Product</span><span>© {new Date().getFullYear()} Emotive Impact. All rights reserved.</span></div></footer>
}

export function V20Homepage() {
  const [me, setMe] = useState<MarketingSession | null>(null)
  useEffect(() => {
    let cancelled = false
    const refresh = () => { void fetch("/api/me", { credentials: "include", cache: "no-store" }).then(async response => {
      const body = await response.json() as MarketingSession
      if (!cancelled && response.ok) setMe(body)
    }).catch(() => {}) }
    refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => { cancelled = true; window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh) }
  }, [])
  const openApp = () => { if (me?.user) navigate("/watch"); else if (me?.githubApp) window.location.assign("/api/auth/github"); else navigate("/watch") }
  return <div className="v20-home homepage-d-shell" id="top"><MarketingNav me={me} openApp={openApp} /><HomepageD scanPath={me?.user ? "/watch/scan" : "/scan"} /><MarketingFooter /></div>
}

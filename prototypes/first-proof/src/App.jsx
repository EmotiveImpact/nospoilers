import { useState } from "react";
import {
  ArrowRight,
  Bell,
  BracketsAngle,
  CaretRight,
  Check,
  Cube,
  CubeTransparent,
  GearSix,
  GithubLogo,
  GlobeHemisphereWest,
  Gauge,
  List,
  LockKey,
  Package,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";

const steps = [
  ["Connect source", "Link a repo or package"],
  ["Detect exposure", "NoSpoilers finds what leaked"],
  ["Resolve finding", "Fix or remove the risk"],
  ["Seal receipt", "Get proof it’s clean"],
];

const watchRows = [
  { icon: GithubLogo, label: "GitHub visibility", detail: "Public repos, commits, branches, and pull requests.", scope: "Includes code, docs, workflows, and issues." },
  { icon: Package, label: "Packed artifacts", detail: "npm packages and other registries.", scope: "Tarballs, libraries, and build outputs." },
  { icon: GlobeHemisphereWest, label: "Deployed web assets", detail: "JavaScript, source maps, and static files.", scope: "CDNs, storage buckets, and web servers." },
];

export function App() {
  const [step, setStep] = useState(1);
  const [activeNav, setActiveNav] = useState("Overview");
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState("");

  function begin(mode) {
    setStep(2);
    setNotice(mode === "github"
      ? "GitHub connection preview opened — no account changes were made."
      : "Sample package scan started. The result below is demonstration data.");
  }

  function progressDemo() {
    const next = Math.min(step + 1, 4);
    setStep(next);
    setNotice(next === 3
      ? "Resolution walkthrough ready. Remove the public map, then re-scan."
      : next === 4
        ? "Sample receipt sealed. Connect a real source to create your own evidence."
        : "Sample evidence opened.");
  }

  const navItem = (label, Icon) => (
    <button key={label} className={`nav-item ${activeNav === label ? "is-active" : ""}`} onClick={() => { setActiveNav(label); setNavOpen(false); }}>
      <Icon size={21} />{label}
    </button>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${navOpen ? "is-open" : ""}`} aria-label="Watch navigation">
        <div className="brand-row">
          <a className="brand" href="#overview" aria-label="NoSpoilers home"><BracketsAngle size={24} weight="bold" /><span>NoSpoilers</span></a>
          <span className="shortcut">⌘K</span>
          <button className="icon-button close-nav" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav>
          <div className="nav-group">{navItem("Overview", Gauge)}{navItem("Alerts", Bell)}</div>
          <div className="nav-group nav-separated">{navItem("Evidence", CubeTransparent)}</div>
          <div className="nav-group nav-separated"><span className="nav-kicker">SETUP</span>{navItem("Settings", GearSix)}</div>
        </nav>
        <div className="sidebar-status">
          <span className="status-orbit"><span /></span>
          <div><strong>{step === 4 ? "Sample proof complete" : "Nothing connected yet"}</strong><small>{step === 4 ? "Connect a source next" : "First Proof · 4 Sep 2026"}</small></div>
        </div>
      </aside>
      {navOpen && <button className="nav-scrim" onClick={() => setNavOpen(false)} aria-label="Close navigation" />}

      <main className="main-stage" id="overview">
        <header className="topbar">
          <button className="icon-button open-nav" onClick={() => setNavOpen(true)} aria-label="Open navigation"><List size={21} /></button>
          <div className="command-bar" aria-label="Search or run a command"><span>Search or run a command…</span><kbd>⌘K</kbd></div>
          <div className="top-actions"><a href="#guide">Guide</a><button className="avatar" aria-label="Open profile">PR</button></div>
        </header>

        <div className="content-wrap">
          <section className="hero" aria-labelledby="page-title">
            <p className="eyebrow">FRIDAY 4 SEPTEMBER 2026</p>
            <h1 id="page-title">Prove your first release is clean.</h1>
            <p className="hero-copy">NoSpoilers watches what attackers see — before you ship.<br />Complete these four steps to get your first sealed receipt.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => begin("github")}><GithubLogo size={21} weight="fill" />Connect a GitHub repo</button>
              <button className="button button-secondary" onClick={() => begin("package")}>Scan a package instead</button>
            </div>
            {notice && <div className="notice" role="status"><Check size={16} weight="bold" />{notice}</div>}
          </section>

          <ol className="progress" aria-label="First proof progress">
            {steps.map(([title, description], index) => {
              const number = index + 1;
              const state = number < step ? "complete" : number === step ? "active" : "upcoming";
              return <li className={state} key={title}>
                <span className="step-number">{state === "complete" ? <Check size={16} weight="bold" /> : number}</span>
                <span className="step-copy"><strong>{title}</strong><small>{description}</small></span>
              </li>;
            })}
          </ol>

          <section className="sample-panel" aria-labelledby="sample-heading">
            <p className="section-kicker">SAMPLE — NOT YOUR DATA</p>
            <div className="package-heading">
              <span className="package-icon"><Cube size={30} /></span>
              <div><h2 id="sample-heading">checkout-web@2.8.1</h2><p>Built from commit a1b2c3d · 4 Sep 2026, 09:12 UTC</p></div>
            </div>
            <div className="finding-grid">
              <div className="finding-summary">
                <div><span className="critical-pill">CRITICAL</span><strong>Exposed source map</strong></div>
                <p>/assets/app.9f3c1d2.js.map <code>JS</code></p>
              </div>
              <div className="impact"><span>Customer impact</span><p>Source maps reveal original code, file structure, and comments. Attackers can reverse engineer your application and find logic or sensitive keys.</p></div>
              <button className="resolution-link" onClick={progressDemo}><CaretRight size={20} /><span><strong>{step >= 4 ? "View sample receipt" : "See how resolution works"}</strong><small>{step >= 4 ? "Proof sealed in this demo" : "View the fix and re-scan"}</small></span></button>
            </div>
            <div className="sample-footnote"><ShieldCheck size={18} />NoSpoilers found this in under 60 seconds during a sample scan of public assets.</div>
          </section>

          <section className="watch-list" aria-labelledby="watch-heading">
            <h2 id="watch-heading">What NoSpoilers watches</h2>
            {watchRows.map(({ icon: Icon, label, detail, scope }) => (
              <button className="watch-row" key={label} onClick={() => setNotice(`${label} details opened in preview.`)}>
                <Icon size={27} /><strong>{label}</strong><span>{detail}</span><span>{scope}</span><CaretRight size={19} />
              </button>
            ))}
          </section>

          <footer id="guide">
            <span><LockKey size={18} />Your data is encrypted in transit and at rest. No code leaves your environment.</span>
            <a href="#overview">Learn more in the Guide <ArrowRight size={16} /></a>
          </footer>
        </div>
      </main>
    </div>
  );
}

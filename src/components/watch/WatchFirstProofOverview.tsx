import { Button } from "@/components/ui/button";
import { navigate } from "@/nav.ts";
import { watchHref, watchPath } from "@/watch/routes.ts";
import {
  Activity,
  ChevronRight,
  FileCheck2,
  GitBranch,
  Globe2,
  LockKeyhole,
  Package,
  ShieldCheck,
} from "lucide-react";

const PROOF_STEPS = [
  ["Connect release surface", "Repo, package, or site"],
  ["Detect exposure", "Inspect what shipped"],
  ["Review findings", "Resolve or document exceptions"],
  ["Seal release proof", "Keep durable evidence"],
] as const;

const NEXT_STEPS = [
  {
    icon: Activity,
    label: "NoSpoilers checks the release surface",
    detail: "The first visibility or artifact check starts from the source you choose.",
  },
  {
    icon: ShieldCheck,
    label: "Overview switches to live evidence",
    detail: "This guide disappears. The page shows only status and findings from the real source.",
  },
  {
    icon: FileCheck2,
    label: "Completed checks preserve their outcome",
    detail: "A signed scan record preserves the recorded scope and decision, including findings. A signature does not mean the release passed.",
  },
] as const;

const WATCH_ROWS = [
  {
    icon: GitBranch,
    label: "GitHub visibility",
    detail: "Repositories, commits, branches, and pull requests.",
  },
  {
    icon: Package,
    label: "Packed artifacts",
    detail: "npm packages, archives, libraries, and build outputs.",
  },
  {
    icon: Globe2,
    label: "Deployed web assets",
    detail: "JavaScript, source maps, static files, and public origins.",
  },
] as const;

export function WatchFirstProofOverview({
  search,
  nowLabel,
  websiteStage,
  connectedSources = false,
}: {
  search: string;
  installUrl?: string;
  nowLabel: string;
  websiteStage?: 'verify' | 'scan' | 'configured';
  connectedSources?: boolean;
}) {
  const setupHref = watchHref(watchPath("setup"), search);
  const sourcesHref = watchHref(watchPath("sources"), search);
  const readyToInspect = websiteStage === 'scan' || (!websiteStage && connectedSources);

  return (
    <div className="watch-first-proof mx-auto max-w-[1140px]">
      <section aria-labelledby="first-proof-title">
        <span className="watch-kicker">{nowLabel}</span>
        <h1 id="first-proof-title" className="watch-first-proof-title">
          Prove your first release is clean.
        </h1>
        <p className="watch-page-lede max-w-2xl">
          NoSpoilers follows a release from source to sealed evidence. Start with the thing you
          actually ship. Each result records the checks performed and their limitations.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          {websiteStage && <Button type="button" onClick={()=>navigate(sourcesHref)}>{websiteStage==='verify'?'Verify website ownership':websiteStage==='scan'?'Run your first website check':'Review website setup'}</Button>}
          {!websiteStage && connectedSources && <Button type="button" onClick={()=>navigate(sourcesHref)}>Choose a connected source to check</Button>}
            <Button type="button" onClick={() => { const params=new URLSearchParams(search);params.set('mode','github');navigate(watchHref(watchPath('scan'),`?${params}`)); }}>
              <GitBranch className="size-4" aria-hidden />
              Connect a GitHub repo
            </Button>
          <Button type="button" variant="outline" onClick={() => {const params=new URLSearchParams(search);params.set('mode','package');navigate(watchHref(watchPath("scan"),`?${params}`));}}>
            Scan a package instead
          </Button>
        </div>
      </section>

      <ol className="watch-proof-steps" aria-label="What happens after you connect">
        {PROOF_STEPS.map(([label, detail], index) => (
          <li key={label} className={index === (readyToInspect?1:0) ? "is-active" : undefined} aria-current={index === (readyToInspect?1:0)?'step':undefined}>
            <span className="watch-proof-step-number">{index + 1}</span>
            <span className="watch-proof-step-copy">
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
          </li>
        ))}
      </ol>

      <section className="watch-proof-next" aria-labelledby="proof-next-title">
        <div className="watch-proof-next-main">
          <span className="watch-kicker">{readyToInspect?'Step 2 of 4 · inspect':'Step 1 of 4 · source'}</span>
          <h2 id="proof-next-title">{websiteStage==='verify'?'Your website is added. Verify ownership next.':websiteStage==='scan'?'Ownership verified. Run your first check.':websiteStage==='configured'?'Review your existing website connection.':connectedSources?'Your sources are connected. Choose one for your first check.':'Connect the release you actually ship.'}</h2>
          <div className="watch-proof-next-rows">
            {NEXT_STEPS.map(({ icon: Icon, label, detail }, index) => (
              <div key={label}>
                <span className="watch-proof-next-icon">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="watch-proof-next-copy">
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <span className="watch-proof-next-number">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <aside className="watch-proof-handoff" aria-label="The live Overview after setup">
          <span className="watch-kicker">Your first release</span>
          <h3>Start with one source. Keep the evidence.</h3>
          <p>
            Your first check creates a saved release record. Review its scope and findings,
            then connect ongoing Coverage when you want to monitor changes.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => navigate(setupHref)}>
            Connection diagnostics
          </Button>
        </aside>
      </section>

      <section className="mt-6" aria-labelledby="proof-watch-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="proof-watch-title" className="font-display text-[17px] tracking-tight text-snow">
            What you can connect
          </h2>
          <button type="button" className="text-xs text-mute hover:text-snow" onClick={() => navigate(sourcesHref)}>
            View Coverage <ChevronRight className="inline size-3.5" aria-hidden />
          </button>
        </div>
        <div className="watch-proof-watch-list">
          {WATCH_ROWS.map(({ icon: Icon, label, detail }) => (
            <button type="button" key={label} onClick={() => navigate(sourcesHref)}>
              <Icon className="size-5" aria-hidden />
              <strong>{label}</strong>
              <span>{detail}</span>
              <ChevronRight className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </section>

      <div className="watch-proof-trust">
        <span>
          <LockKeyhole className="size-4" aria-hidden />
          Packed code is inspected for exposure evidence, not retained as source.
        </span>
        <button type="button" onClick={() => navigate(setupHref)}>
          Add your first coverage <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

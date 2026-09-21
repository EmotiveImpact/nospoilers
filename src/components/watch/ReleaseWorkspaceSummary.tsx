import {Box, Fingerprint, Globe2, ShieldCheck, ShieldAlert, CircleHelp} from 'lucide-react';
import './design/release-workspace.css';

export type ReleaseWorkspaceState = {
  key: string; label: string; status: string; detail: string; tone?: string;
};
const icons = [Box, Fingerprint, Globe2, ShieldCheck];
export function ReleaseWorkspaceSummary({title, detail, tone, findingCount, scope, states}: {
  title: string; detail: string; tone: string; findingCount?: number; scope: string; states: ReleaseWorkspaceState[];
}) {
  const DecisionIcon = tone === 'ready' ? ShieldCheck : tone === 'blocked' || tone === 'review' ? ShieldAlert : CircleHelp;
  return <>
    <section className={`release-workspace-decision is-${tone}`} aria-label="Recorded release decision">
      <div><DecisionIcon aria-hidden/><div><h2>{title}</h2><p>{detail}</p></div></div>
      {findingCount !== undefined ? <span className="release-workspace-count">{findingCount} finding{findingCount === 1 ? '' : 's'}</span> : null}
    </section>
    <p className="release-workspace-scope">{scope}</p>
    <div className="release-workspace-states" role="group" aria-label="Independent evidence states">
      {states.map((state, index) => { const Icon = icons[index] ?? CircleHelp; return <div className="release-evidence-state" key={state.key} role="group" aria-label={state.label} title={state.detail}>
        <span><Icon aria-hidden/>{state.label}</span><strong className={`is-${state.tone ?? 'unknown'}`}>{state.status}</strong>
        <span className="sr-only">{state.detail}</span>
      </div>; })}
    </div>
  </>;
}

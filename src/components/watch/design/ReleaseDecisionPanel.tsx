import type {ReactNode} from 'react';

/** Presentation only: each evidence model retains its own decision semantics. */
export function ReleaseDecisionPanel({tone,icon,kicker,title,description,children,summary}:{tone:string;icon:ReactNode;kicker:string;title:string;description:ReactNode;children?:ReactNode;summary:ReactNode}){
 return <article className={`watch-release-decision is-${tone}`}><div className="watch-release-verdict-icon" aria-hidden>{icon}</div><div className="min-w-0"><span className="watch-kicker">{kicker}</span><h2>{title}</h2><p>{description}</p>{children}</div>{summary}</article>;
}

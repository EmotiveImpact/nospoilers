import './pieces.css';

export type ReceiptCheckState={status:'checking'}|{status:'passed'}|{status:'failed';reason:string}|{status:'unavailable';reason:string};

/** The receipt check as a terminal would print it. The outcome line is the server's verification, never assumed. */
export function ReceiptCheck({fileName,state,result}:{fileName:string;state:ReceiptCheckState;result:string}){
  return <div className="np"><pre className="np-term" aria-live="polite"><span className="np-prompt">$</span> nospoilers verify --receipt {fileName}{'\n'}
{state.status==='checking'?<span className="is-dim">Checking the signed record…</span>
  :state.status==='passed'?<><span className="is-pass">Receipt passed</span> <span className="is-dim">·</span> SHA-256 matches</>
  :state.status==='failed'?<span className="is-fail">Receipt check failed · {state.reason}</span>
  :<span className="is-dim">{state.reason}</span>}{'\n'}
{'  '}<span className="is-dim">result:</span> {result}</pre></div>;
}

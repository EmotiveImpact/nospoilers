import type {AssuranceView, CheckState} from './types.ts';
const LABELS:Record<CheckState,string>={passed:'Passed',failed:'Failed',review:'Review',unknown:'Unknown',stale:'Stale','not-configured':'Not configured'};
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string,className?:string):HTMLElementTagNameMap[K]{
  const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;
}
function details(title:string):HTMLDetailsElement{const node=element('details');node.append(element('summary',title));return node;}
function badge(state:CheckState){return element('span',LABELS[state],`ns-assurance__badge is-${state}`);}
export function renderAssurancePanel(root:HTMLElement,view:AssuranceView,actions:{review:()=>void;refresh:()=>void;exportPassport:()=>void},options:{supporting?:boolean}={}):()=>void{
  const events=new AbortController();
  const {assessment,comparison,investigation}=view;
  const panel=element('section',undefined,'ns-assurance');
  panel.setAttribute('aria-label','Release assurance companion');
  const header=element('header',undefined,'ns-assurance__header');
  const heading=element('div');heading.append(element('p','From evidence to action','ns-assurance__eyebrow'),element('h2','Release assurance'));
  const timing=element('p',`Saved evidence reviewed at ${new Date(assessment.evaluatedAt).toISOString().replace('T',' ').slice(0,19)} UTC.`,'ns-assurance__muted');
  header.append(heading,timing);panel.append(header);
  const grid=element('div',undefined,'ns-assurance__decision-grid');
  const decision=element('article',undefined,`ns-assurance__decision is-${assessment.beforeDeploy}`);
  const label=element('p',view.source==='website-scan'?'Recorded website observation':'Before-deployment evidence','ns-assurance__eyebrow');
  const title=element('h3',assessment.title),summary=element('p',assessment.summary);
  decision.append(label,title,summary);
  const delivery=element('article',undefined,'ns-assurance__delivery');
  delivery.append(element('p','Separate stage','ns-assurance__eyebrow'),element('h3','Published delivery'),badge(assessment.afterDeploy),element('p',assessment.checks.find(check=>check.id==='delivery')?.detail??'No delivery evidence is available.'));
  if(!options.supporting)grid.append(decision);
  grid.append(delivery);panel.append(grid);
  if(options.supporting)grid.style.gridTemplateColumns='1fr';
  const controls=element('div',undefined,'ns-assurance__actions');
  function button(text:string,callback:()=>void,primary=false){const node=element('button',text,primary?'ns-assurance__primary':'');node.type='button';node.addEventListener('click',callback,{signal:events.signal});return node;}
  const nextLabels:Record<string,string>={'inspect-evidence':'Inspect existing evidence','review-findings':'Review recorded findings','review-exceptions':'Review recorded exceptions','review-approval':'Review evidence and approval','configure-delivery':'Review release scope','verify-delivery':'Review delivery evidence','keep-watching':'Review release evidence'};
  controls.append(button(nextLabels[assessment.nextAction]??'Review existing evidence',actions.review,true),button('Refresh saved snapshot',actions.refresh),button('Export private passport',actions.exportPassport));
  panel.append(controls,element('p','Refreshing reads saved records. It does not scan, deploy, approve or publish anything.','ns-assurance__muted'));
  const checks=details('See exactly what supports this review');
  const list=element('ul',undefined,'ns-assurance__checks');
  for(const check of assessment.checks){const li=element('li'),row=element('div');row.append(element('strong',check.label),badge(check.state));li.append(row,element('p',check.detail));list.append(li);}
  checks.append(list);panel.append(checks);
  const comparisonBlock=element('section',undefined,'ns-assurance__comparison');
  comparisonBlock.append(element('h3','What changed since the earlier release?'));
  if(comparison.available&&comparison.counts){
    comparisonBlock.append(element('p',`Compared with release ${comparison.previousReleaseId}. This is an eligible passing reference, not an automatically approved baseline.`));
    const counts=element('dl',undefined,'ns-assurance__counts');
    for(const [key,label] of [['added','Added'],['removed','Removed'],['changed','Changed'],['unchanged','Unchanged']] as const){const row=element('div');row.append(element('dt',label),element('dd',String(comparison.counts[key])));counts.append(row);}
    comparisonBlock.append(counts);
    comparisonBlock.append(element('p',`${comparison.newFindingCount??0} newly observed finding(s). ${comparison.noLongerObservedCount??0} no longer observed. ${comparison.newlySuppressedCount??0} newly suppressed. A missing finding alone does not prove it was fixed.`));
    if(comparison.policyChanged||comparison.engineChanged)comparisonBlock.append(element('p','Comparison context changed: review the policy and scanner versions before interpreting improvements.','ns-assurance__notice'));
    const paths=details('Inspect recorded file changes');
    for(const [key,label] of [['added','Added'],['removed','Removed'],['changed','Changed']] as const){paths.append(element('h4',label));const ul=element('ul');for(const name of comparison.paths[key]){const li=element('li');li.append(element('code',name));ul.append(li);}if(!comparison.paths[key].length)ul.append(element('li','None recorded in this category.'));paths.append(ul);}
    if(comparison.truncated)paths.append(element('p','Showing at most 50 file paths per category. Counts cover the compared manifests.'));
    comparisonBlock.append(paths);
  }else comparisonBlock.append(element('p',comparison.reason),element('p','A first release is still useful. Comparison becomes available when a compatible earlier record exists.','ns-assurance__muted'));
  panel.append(comparisonBlock);
  const assistant=details('Evidence-led next steps');
  assistant.append(element('p',investigation.caveat,'ns-assurance__muted'));
  const steps=element('ol',undefined,'ns-assurance__steps');
  for(const step of investigation.steps){const li=element('li');li.append(element('strong',step.title),element('p',step.detail));steps.append(li);}
  assistant.append(steps);panel.append(assistant);
  const simulator=details('Preview a stricter review');
  const toggleLabel=element('label',undefined,'ns-assurance__toggle');const toggle=element('input');toggle.type='checkbox';
  toggleLabel.append(toggle,document.createTextNode('Treat recorded non-blocking findings as blocking in this preview'));
  const announcement=element('p','Preview only. The saved policy and receipt will not change.','ns-assurance__muted');announcement.setAttribute('role','status');
  toggle.addEventListener('change',()=>{const selected=toggle.checked?view.strictPreview:assessment;title.textContent=selected.title;summary.textContent=selected.summary;label.textContent=toggle.checked?'What-if preview, not the saved decision':view.source==='website-scan'?'Recorded website observation':'Before-deployment evidence';decision.className=`ns-assurance__decision is-${selected.beforeDeploy}`;announcement.textContent=toggle.checked?'Stricter preview shown. No policy was saved and no deployment gate changed.':'Recorded evidence review restored. No changes were saved.';},{signal:events.signal});
  if(options.supporting){decision.hidden=true;toggle.addEventListener('change',()=>{decision.hidden=!toggle.checked;},{signal:events.signal});simulator.append(decision);}
  simulator.append(toggleLabel,announcement);panel.append(simulator);
  const boundaries=details('What this review does not prove');
  const limits=element('ul');for(const limitation of assessment.limitations)limits.append(element('li',limitation));boundaries.append(limits);
  boundaries.append(element('p','The passport is an unsigned private summary. The original signed scan record remains the evidence of record. Review identifiers before sharing.'));
  panel.append(boundaries);root.replaceChildren(panel);
  return ()=>{events.abort();root.replaceChildren();};
}

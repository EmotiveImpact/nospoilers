/* Review-only extension. No customer data, API calls, or real security configuration. */
(() => {
  const requestedView = params.get('view');
  const main = document.querySelector('main');
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function button(text, action, className = 'secondary') {
    const node = make('button', text, className);
    node.type = 'button'; node.onclick = action; return node;
  }
  function screen(id, eyebrow, title, description) {
    const section = make('section', '', 'view readiness-view');
    section.dataset.screen = id;
    section.setAttribute('aria-labelledby', `${id}-heading`);
    const head = make('div', '', 'page-head');
    const copy = make('div');
    copy.append(make('p', eyebrow, 'eyebrow'));
    const heading = make('h1', title); heading.id = `${id}-heading`;
    copy.append(heading, make('p', description)); head.append(copy);
    section.append(head); main.append(section); return section;
  }
  function card(title, body) {
    const article = make('article', '', 'readiness-card');
    article.append(make('h2', title), make('p', body)); return article;
  }
  function navigate(view) { showView(view); document.querySelector(`[data-screen="${view}"] h1`)?.focus({preventScroll:true}); }
  const nav = document.querySelector('.app-nav');
  const releaseNav = nav.querySelector('[data-side-view="release"]');
  releaseNav.dataset.sideView = 'releases'; releaseNav.href = '?view=releases';
  releaseNav.onclick = e => { e.preventDefault(); navigate('releases'); };
  const settingsNav = [...nav.querySelectorAll('a')].find(a => a.textContent.trim() === 'Settings');
  settingsNav.dataset.sideView = 'settings'; settingsNav.href = '?view=settings';
  settingsNav.onclick = e => { e.preventDefault(); navigate('settings'); };
  for (const [id, label] of [['overview','Daily overview'], ['releases','Release history'], ['settings','Workspace settings']]) {
    const item = button(label, () => navigate(id), ''); item.dataset.view = id;
    document.querySelector('.reviewbar nav').append(item);
  }

  const overview = screen('overview', 'WORKSPACE · ACME', 'Your release exposure, at a glance.', 'A daily view once real evidence exists. First Proof remains the empty-workspace experience.');
  const metrics = make('div', '', 'readiness-grid');
  for (const [title, detail] of [['1 release needs attention', 'Checkout web has a blocking source-map finding.'], ['4 monitored surfaces', '3 healthy · 1 production check delayed.'], ['2 open alerts', '1 assigned to you · 1 needs an owner.']]) metrics.append(card(title, detail));
  overview.append(metrics);
  const next = card('Review the checkout-web release', 'Inspect the finding, follow the fix, then recheck. Closing the alert alone does not produce passing release proof.');
  next.append(button('Open release brief', () => openRelease('blocked'), 'primary'));
  overview.append(next);
  const watch = card('Monitoring needs attention', 'The production website has not completed its latest check. The previous result remains dated; it must not be presented as current evidence.');
  watch.append(button('Review coverage', () => navigate('sources'))); overview.append(watch);
  overview.append(button('Review first-time experience', () => navigate('first')));

  const outcomes = {
    blocked: ['Hold this release', '1 critical and 2 high findings require review. No passing proof can be issued.', 'Review blocking finding'],
    queued: ['Scan queued', 'The artifact is waiting for a worker. No result is available yet. You can safely leave this page.', 'Simulate completed check'],
    failed: ['Scan could not complete', 'The worker stopped before completing the check. Previous evidence is unchanged. Retry creates a new attempt.', 'Retry sample scan'],
    inconclusive: ['More evidence is needed', 'An encrypted payload could not be inspected. Unknown does not mean clean; passing proof remains unavailable.', 'Choose a supported artifact'],
    clean: ['No exposure found in this check', 'The sample artifact passed the configured checks. This is scoped, dated evidence, not a guarantee that software is vulnerability-free.', 'Inspect sample proof'],
  };
  const releases = screen('releases', 'RELEASE HISTORY', 'Releases', 'Each row is a distinct artifact or deployment. Select any release to preview its own evidence.');
  const layout = make('div', '', 'readiness-split'); const list = make('div', '', 'readiness-release-list');
  const preview = make('aside', '', 'readiness-card'); preview.setAttribute('aria-live','polite');
  const samples = [['checkout-web v2.8.1','Production · commit 14316…','blocked'],['payments v4.6.2','npm package · digest b451…','clean'],['worker v1.9.0','CI artifact · waiting for worker','queued'],['desktop v0.8.0','Encrypted archive · inspection incomplete','inconclusive'],['checkout-web v2.8.2','Production · worker interrupted','failed']];
  function selectRelease(sample) {
    list.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.outcome === sample[2])));
    preview.replaceChildren(make('p','SELECTED RELEASE','eyebrow'),make('h2',sample[0]),make('p',sample[1]),make('strong',outcomes[sample[2]][0]),make('p',outcomes[sample[2]][1]),button('Open full release',()=>openRelease(sample[2],sample[0]),'primary'));
  }
  for(const sample of samples) {
    const row = button('',()=>selectRelease(sample),'readiness-release-row'); row.dataset.outcome=sample[2];
    row.append(make('strong',sample[0]),make('small',sample[1]),make('span',outcomes[sample[2]][0]));list.append(row);
  }
  layout.append(list,preview); releases.append(layout); selectRelease(samples[0]);

  const detail = document.querySelector('[data-screen="release"]');
  const originalDecision = detail.querySelector('.decision');
  const alternate = card('', ''); alternate.hidden=true; alternate.setAttribute('role','status'); originalDecision.after(alternate);
  const selector = make('label', '', 'readiness-scenario'); selector.append(make('span','Review a release state'));
  const select = make('select'); select.setAttribute('aria-label','Release state');
  Object.entries(outcomes).forEach(([value, copy])=>{const option=make('option',copy[0]);option.value=value;select.append(option);});
  select.onchange=()=>openRelease(select.value); selector.append(select); detail.prepend(selector);
  function openRelease(outcome, name='checkout-web v2.8.1') {
    const copy=outcomes[outcome]||outcomes.blocked; select.value=outcome;
    document.querySelector('#release-title').textContent=name;
    const metadata=detail.querySelector('.release-headline p:not(.eyebrow)');
    metadata.textContent = `${name} · sample evidence · review only`;
    originalDecision.hidden=outcome!=='blocked'; alternate.hidden=outcome==='blocked';
    detail.querySelector('.score').hidden=true; // A percentage cannot represent incomplete or skipped checks.
    detail.querySelector('.result-tabs').hidden=outcome!=='blocked'; detail.querySelector('.result-workspace').hidden=outcome!=='blocked';
    alternate.replaceChildren(make('p','RELEASE DECISION','eyebrow'),make('h2',copy[0]),make('p',copy[1]),button(copy[2],()=>{
      if(outcome==='queued')openRelease('blocked',name);
      else if(outcome==='failed')openRelease('queued',name);
      else if(outcome==='clean')navigate('proof');
      else navigate('scan');
    },'primary'));
    navigate('release');
  }

  const proof=screen('proof','SAMPLE VERIFICATION','What does release proof prove?','It binds a particular artifact to a dated check and policy. It does not run another scan or reveal secret values.');
  const proofCard=card('Sample signature valid · check passed','This is a simulated verification record. The real verifier must validate the signature, artifact digest, issuer, timestamp, policy and revocation state.');
  const facts=make('dl');
  for(const [label,value] of [['Artifact','payments v4.6.2'],['Digest','sha256:b451… (abbreviated sample)'],['Scope','Packed artifact only; production website not checked'],['Policy','Default exposure policy · revision 3'],['Proof visibility','Redacted metadata; no source code or secret values']]) {facts.append(make('dt',label),make('dd',value));}
  proofCard.append(facts,button('Back to releases',()=>navigate('releases')));proof.append(proofCard);

  const settings=screen('settings','WORKSPACE · ACME','Settings','Manage who can act, which policy applies, and where evidence goes. All changes here are simulated.');
  const tabs=make('nav','','readiness-tabs');tabs.setAttribute('aria-label','Settings sections');
  const settingsBody=make('div'); settings.append(tabs,settingsBody);
  const settingsCopy={
    team:['Team & access','Roles determine what people can do. Production enforcement must happen on every API request.','Admin · manage policy, billing and integrations','Responder · investigate and acknowledge exposure','Viewer · read evidence without changing it'],
    identity:['Enterprise identity','Planned capability: SSO and provisioning are not implemented in this prototype or proven in production.','SSO · verified organization domain and enforced sign-in','Provisioning · remove access when a teammate leaves','Recovery · audited emergency administrator access'],
    policy:['Release policy','A policy decision must record who approved it and which revision was evaluated.','Critical finding · block passing proof','Incomplete inspection · inconclusive, never clean','Exception · reason, owner, approver and expiry required'],
    evidence:['Evidence & retention','Make retention explicit for uploads, reports, audit events and backups. Do not promise immediate deletion unless each storage layer supports it.','Uploads · short-lived staging, deleted after processing or expiry','Reports · installation policy controls retention','Audit export · actor, action, target and timestamp'],
    integrations:['Integrations','Connection status includes last delivery and a recovery action. A saved credential alone does not prove delivery works.','GitHub · installation access needs verification','Notifications · send a delivery test before enabling','CI token · scoped to one installation; reveal once and revoke'],
    billing:['Billing & usage','Five-day trial for self-service evaluation. Enterprise evaluations need an agreed scope and success criteria.','Trial ended · preserve authorized access to existing evidence','Hosted scans · pause until coverage is active','Enterprise · agreed evaluation, procurement and contract'],
  };
  function renderSettings(key){
    tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.section===key)));
    const copy=settingsCopy[key], article=card(copy[0],copy[1]);
    for(const row of copy.slice(2))article.append(make('p',row,'readiness-setting-row'));
    if(key==='policy') {
      const label=make('label','Sample approval requirement','readiness-scenario'), input=make('select');
      for(const text of ['One independent approver','Two independent approvers'])input.append(make('option',text));
      label.append(input);article.append(label,button('Save sample policy',()=>{toast('Sample policy saved in this preview only.');log.textContent=`Just now · Augustus changed approval requirement to: ${input.value}`;},'primary'));
    }
    if(key==='integrations')article.append(button('Simulate failed delivery',()=>{log.textContent='Delivery failed · destination unavailable. Credentials are hidden. Retry after checking the destination.';}),button('Simulate successful retry',()=>{log.textContent='Sample delivery received · just now. No real notification was sent.';}));
    const log=make('p','No changes in this preview session.','readiness-event');log.setAttribute('role','status');article.append(log);settingsBody.replaceChildren(article);
  }
  Object.entries(settingsCopy).forEach(([key,copy])=>{const tab=button(copy[0],()=>renderSettings(key));tab.dataset.section=key;tabs.append(tab);});renderSettings('team');
  const foot=document.querySelector('.rail-foot');foot.querySelector('strong').textContent='Acme workspace';foot.querySelector('small').textContent='Sample data · review only';foot.querySelector('.coverage').textContent='AC';
  // All tab groups remain keyboard reachable; arrow keys also work with the existing roving alert tabs.
  document.addEventListener('keydown',event=>{
    const group=event.target.closest('[role="tablist"]');if(!group||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...group.querySelectorAll('button')];let index=buttons.indexOf(document.activeElement);
    if(index<0)return;event.preventDefault();event.stopImmediatePropagation();
    index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[index].click();buttons[index].focus();
  },true);
  document.querySelectorAll('.view h1').forEach(h=>h.tabIndex=-1);
  if(['overview','releases','settings','proof'].includes(requestedView))navigate(requestedView);
})();

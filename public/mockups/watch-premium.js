/* Premium Watch approval prototype. Network policy: authenticated same-origin GET only. */
(() => {
  "use strict";
  const app = document.querySelector("#app");
  const main = document.querySelector("#main");
  const nav = document.querySelector("#nav");
  const layer = document.querySelector("#dialog-layer");
  const dialog = layer.querySelector(".dialog");
  const dialogContent = document.querySelector("#dialog-content");
  const state = { route: location.hash.slice(1) || "overview", preview: "live", selectedAlert: null, selectedSource: null, data: null, status: "loading", error: "", lastFocus: null, paletteIndex: 0 };
  const groups = [
    ["Work", [["overview","Overview","overview"],["alerts","Alerts","alert"],["sources","Sources","source"],["releases","Releases","release"]]],
    ["Evidence", [["timeline","Timeline","timeline"],["setup","Setup","setup"]]],
    ["Configure", [["notifications","Notifications","settings"],["policy","Policy","settings"],["team","Team","settings"],["retention","Retention","settings"],["audit","Audit","settings"],["health","Install health","settings"],["tokens","Tokens","settings"],["registries","Registries","settings"]]]
  ];
  const apiPaths = ["repos","alerts","packages","origins","map-destinations","releases","destinations","destinations/routes","destinations/deliveries","jobs","retention","signing-policy","audit","registries","scan-tokens","exceptions","timeline"];
  const labels = { overview:"Overview",alerts:"Alerts",sources:"Sources",releases:"Releases",timeline:"Timeline",setup:"Setup",notifications:"Notifications",policy:"Policy",team:"Team",retention:"Retention",audit:"Audit log",health:"Install health",tokens:"Scan API tokens",registries:"Private registries" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = value => { if (!value) return "Not recorded"; const d = new Date(value); return Number.isNaN(d.valueOf()) ? "Not recorded" : new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(d); };
  const age = value => { if (!value) return "Not checked"; const n = Date.now()-new Date(value).valueOf(); if(n<60000)return "just now"; if(n<3600000)return `${Math.floor(n/60000)} min ago`; if(n<86400000)return `${Math.floor(n/3600000)} hr ago`; return `${Math.floor(n/86400000)} d ago`; };
  const list = (key) => state.data?.[key] ?? [];
  const scoped = path => { const id=state.data?.me?.installations?.[0]?.id; return `/api/${path}${id ? `${path.includes("?")?"&":"?"}installationId=${encodeURIComponent(id)}`:""}`; };
  async function getJson(url) {
    const response = await fetch(url, { method: "GET", credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(response.status === 401 ? "Sign in required" : `Could not load (${response.status})`);
    return response.json();
  }
  async function load() {
    state.status="loading"; render();
    try {
      const me=await getJson("/api/me");
      if(!me.user){ state.data={me}; state.status="signed-out"; render(); return; }
      const results=await Promise.allSettled(apiPaths.map(p=>getJson(scoped(p))));
      const data={me}, errors=[];
      results.forEach((r,i)=>{ const key=apiPaths[i]; if(r.status==="fulfilled"){ const body=r.value; data[key]=body[Object.keys(body).find(k=>Array.isArray(body[k]))] ?? body; data[`${key}:raw`]=body; } else errors.push(`${key}: ${r.reason.message}`); });
      const install=me.installations?.[0];
      if(install) {
        const members=await Promise.allSettled([getJson(`/api/installations/${encodeURIComponent(install.id)}/members`)]);
        if(members[0].status==="fulfilled") data.members=members[0].value.members ?? [];
      }
      state.data=data; state.status=errors.length ? "partial" : "ready"; state.error=errors.join(" · ");
    } catch(error){ state.status=error.message==="Sign in required"?"signed-out":"error"; state.error=error.message; }
    render();
  }
  function icon(id){return `<svg aria-hidden="true"><use href="#${id}"/></svg>`}
  function navMarkup(){
    return groups.map(([heading,items])=>`<div class="nav-group"><div class="nav-heading">${heading}</div>${items.map(([route,label,ico])=>`<button class="nav-button ${state.route===route?"active":""}" data-route="${route}">${icon(ico)}<span>${label}</span>${route==="alerts"&&list("alerts").filter(a=>!a.resolved_at).length?`<span class="count">${list("alerts").filter(a=>!a.resolved_at).length}</span>`:""}</button>${route==="alerts"?`<button class="nav-button nested" data-route="alerts">Needs triage</button><button class="nav-button nested" data-route="alerts">Assigned to me</button><button class="nav-button nested" data-route="alerts">Resolved</button>`:""}`).join("")}</div>`).join("");
  }
  function effectiveStatus(){ return state.preview==="live" ? state.status : state.preview; }
  function gate(title,text,cls=""){return `<div class="state-banner ${cls}"><span class="dot"></span><div><strong>${title}</strong><div>${text}</div></div></div>`}
  function shellState(content){
    const s=effectiveStatus();
    if(s==="loading") return `<div class="page"><div class="skeleton"></div><div class="grid section"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
    if(s==="signed-out") return `<div class="page"><div class="empty-state card"><strong>Sign in to view installation data</strong>This prototype reads your current Watch installation through authenticated same-origin GET requests. No rows are shown while signed out.<div class="section"><a class="button" href="/api/auth/github">Sign in with GitHub</a></div></div></div>`;
    if(s==="error") return `<div class="page">${gate("Data unavailable",state.preview==="error"?"UI-state preview: the request failed. No status or entity rows are assumed.":esc(state.error),"error")}<button class="button secondary" id="retry">Try again</button></div>`;
    const banners=[];
    if(state.status==="partial"&&state.preview==="live") banners.push(gate("Some data is unavailable",esc(state.error),"error"));
    if(s==="paused") banners.push(gate("Paused · UI-state preview","New checks are paused. Existing rows remain readable; this preview makes no assertion about the installation."));
    if(s==="ended") banners.push(gate("Coverage ended · UI-state preview","New jobs and scans are stopped. Existing alerts remain readable."));
    if(["member","solo","team"].includes(s)) banners.push(gate(`${s[0].toUpperCase()+s.slice(1)} · UI-state preview`,"Permission and plan presentation only; entity rows still come from GET responses."));
    return `<div class="page">${banners.join("")}${content}</div>`;
  }
  function empty(title,text){return `<div class="empty-state card"><strong>${title}</strong>${text}</div>`}
  function statusBadge(value){
    const v=String(value??"unknown").toLowerCase(), cls=/fail|critical|open|mismatch/.test(v)?"danger":/warn|inconclusive|pending/.test(v)?"warn":/pass|clean|ok|verified|resolved|matched/.test(v)?"ok":"";
    return `<span class="badge ${cls}"><span class="dot"></span>${esc(value??"Unknown")}</span>`;
  }
  function title(text,subtitle,action=""){return `<div class="page-head"><div><div class="eyebrow">Watch desk</div><h1>${text}</h1><p class="lede">${subtitle}</p></div>${action}</div>`}
  function overview(){
    const alerts=list("alerts"), open=alerts.filter(a=>!a.resolved_at), sources=[...list("repos"),...list("packages"),...list("origins"),...list("map-destinations")], releases=list("releases"), jobs=state.data?.["jobs:raw"]?.summary;
    if(effectiveStatus()==="empty") return shellState(title("Nothing is being watched yet.","Empty UI-state preview; no installation entities are displayed.")+empty("No connected sources","Connect a real source in the production experience after this design is approved."));
    const lead=open[0];
    return shellState(`${title(open.length?`${open.length} item${open.length===1?"":"s"} need attention.`:"No open exposure is reported.","Verdict first: the highest-priority incident leads; operational counts remain subordinate.")}
      <div class="grid metrics"><div class="card metric primary"><div class="eyebrow">Active incident</div><div class="metric-value">${lead?esc(lead.title):"None reported"}</div><small>${lead?`${esc(lead.kind)} · ${age(lead.created_at)}`:"Based on the alerts response"}</small></div><div class="card metric"><div class="eyebrow">Open alerts</div><div class="metric-value">${open.length}</div><small>Unresolved</small></div><div class="card metric"><div class="eyebrow">Receipts</div><div class="metric-value">${releases.length}</div><small>Returned by API</small></div><div class="card metric"><div class="eyebrow">Queue</div><div class="metric-value">${jobs?jobs.queued+jobs.running:"—"}</div><small>${jobs?"Queued and running":"Unavailable"}</small></div></div>
      <section class="section"><div class="section-head"><h2>Exposure by source</h2><button class="button ghost" data-route="timeline">Full timeline</button></div>${exposureChart(alerts,sources.slice(0,4))}</section>
      <section class="section"><div class="section-head"><h2>Source preview</h2><button class="button ghost" data-route="sources">View all</button></div>${sourceRows(sources.slice(0,3))}</section>
      <section class="section card pad"><div class="eyebrow">Prioritized setup action</div><h2 style="margin-top:8px">${sources.length?"Check remaining leak-path coverage":"Connect the first leak path"}</h2><p class="lede">The setup screen distinguishes confirmed, incomplete, and check-needed states.</p><button class="button secondary section" data-route="setup">Open guided setup</button></section>`);
  }
  function exposureChart(alerts,sources){
    if(!sources.length) return empty("No source lanes available","No timeline bars are inferred without real source or alert timestamps.");
    return `<div class="card timeline"><div class="timeline-grid" role="img" aria-label="Retained-window exposure lanes">${sources.map((s,i)=>{const a=alerts[i]; const name=s.full_name||s.package_name||s.origin_url||[s.orgSlug,s.projectSlug].filter(Boolean).join("/");return `<div class="lane"><div class="lane-label"><strong class="truncate">${esc(name)}</strong><div class="meta">${a?"Alert timestamp available":"No linked alert"}</div></div><div class="track">${a?`<span class="span" style="left:${Math.max(2,70-i*8)}%;right:${a.resolved_at?8:2}%">${esc(a.kind)} · ${a.resolved_at?"resolved":"open"}</span>`:""}</div></div>`}).join("")}</div><table class="sr-only"><caption>Text equivalent of exposure chart</caption><tbody>${sources.map((s,i)=>`<tr><th>${esc(s.full_name||s.package_name||s.origin_url||s.projectSlug)}</th><td>${alerts[i]?`${esc(alerts[i].kind)}, ${alerts[i].resolved_at?"resolved":"open"}, opened ${fmt(alerts[i].created_at)}`:"No linked alert"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function alerts(){
    const alerts=list("alerts");
    if(effectiveStatus()==="empty"||!alerts.length) return shellState(title("Alerts","Full-height inbox and detail workspace.")+empty("No alerts returned","The inbox remains structurally empty; no sample incidents are inserted."));
    if(!state.selectedAlert) state.selectedAlert=alerts[0].id;
    const selected=alerts.find(a=>a.id===state.selectedAlert)||alerts[0];
    const findings=selected.findings||[];
    return `<div class="alerts-workspace ${state.selectedAlert?"detail-open":""}"><section class="inbox"><div class="pane-head"><strong>Inbox</strong><span class="badge">${alerts.length}</span></div>${alerts.map(a=>`<button class="list-row ${a.id===selected.id?"selected":""}" data-alert="${a.id}"><span><strong>${esc(a.title)}</strong><div class="meta">${esc(a.kind)} · ${esc(a.full_name||"Source not named")}</div></span>${statusBadge(a.resolved_at?"Resolved":a.acknowledged_at?"Acknowledged":"Open")}<span class="meta">${age(a.created_at)}</span><span>›</span></button>`).join("")}</section>
      <section class="alert-detail"><div class="sticky-actions"><button class="button ghost back-inbox" id="back-inbox">← Back to inbox</button><button class="button secondary" data-dialog="assign-dialog">Assign</button><button class="button" data-dialog="resolve-dialog">${selected.resolved_at?"Reopen":"Resolve"}</button><button class="button ghost" id="previous-alert">Previous</button><button class="button ghost" id="next-alert">Next</button></div><div class="detail-body"><div class="row">${statusBadge(selected.resolved_at?"Resolved":"Open")}<span class="badge">${esc(selected.kind)}</span><span class="badge">${age(selected.created_at)} exposure age</span></div><h1 class="section">${esc(selected.title)}</h1><p class="lede">${esc(selected.body)}</p><section class="section"><h2>Findings</h2><div class="card section">${findings.length?findings.map(f=>`<div class="finding"><span><strong>${esc(f.rule||f.ruleId||selected.kind)}</strong><div class="meta">${esc(f.path||"Path not returned")}</div></span>${statusBadge(f.severity||"Finding")}</div>`).join(""):`<div class="empty-state">No finding rows returned.</div>`}</div></section><section class="section"><h2>Exposure</h2><div class="card pad section"><div class="exposure"><span>${selected.resolved_at?"Closed":"Open"} · ${age(selected.created_at)}</span></div></div></section><section class="section"><h2>Rotation checklist</h2><ul class="checklist">${(selected.rotation_checklist||[]).length?selected.rotation_checklist.map(x=>`<li>□ ${esc(x)}</li>`).join(""):"<li>No checklist items returned.</li>"}</ul></section><section class="section"><h2>Activity</h2><div class="card pad section"><span class="meta">Opened ${fmt(selected.created_at)}</span></div></section></div></section></div>`;
  }
  function allSources(){return [...list("repos").map(x=>({...x,_type:"GitHub",_name:x.full_name,_status:x.private?"Private":"Public",_time:x.last_checked_at})),...list("packages").map(x=>({...x,_type:"npm",_name:x.package_name,_status:x.last_scan_status||"Unknown",_time:x.last_checked_at})),...list("origins").map(x=>({...x,_type:"Site",_name:x.origin_url,_status:x.last_scan_status||"Unknown",_time:x.last_checked_at})),...list("map-destinations").map(x=>({...x,_type:"Map custody",_name:[x.orgSlug,x.projectSlug].filter(Boolean).join("/"),_status:x.lastStatus||"Unknown",_time:x.lastCheckedAt}))];}
  function sourceRows(rows){return rows.length?`<div class="card">${rows.map((s,i)=>`<button class="list-row" data-source="${esc(s._type||"source")}:${esc(s.id??i)}"><span><strong>${esc(s._name||s.full_name||s.package_name||s.origin_url||s.projectSlug)}</strong><div class="meta">${esc(s._type||"Source")}</div></span>${statusBadge(s._status||"Connected")}<span class="meta">${age(s._time)}</span><span>Open ›</span></button>`).join("")}</div>`:empty("No sources returned","No source rows are fabricated.");
  }
  function sources(){
    const rows=allSources(), selected=rows.find((s,i)=>`${s._type}:${s.id??i}`===state.selectedSource);
    if(selected) return shellState(title("Source detail",esc(selected._name),`<button class="button ghost" id="back-sources">Back to sources</button>`)+`<div class="grid settings-grid"><section class="card setting-card"><div class="eyebrow">Setup facts</div><div class="list-row"><span>Type</span><strong>${esc(selected._type)}</strong></div><div class="list-row"><span>Status</span>${statusBadge(selected._status)}</div><div class="list-row"><span>Last check</span><strong>${fmt(selected._time)}</strong></div></section><section class="card setting-card"><div class="eyebrow">Linked context</div><p class="lede">Release, package, map, and policy relationships appear only when returned by their respective APIs.</p><div class="row section"><button class="button secondary" data-route="releases">Releases</button><button class="button ghost" data-route="policy">Policy</button><button class="button ghost" data-dialog="action-dialog">Context actions</button></div></section></div>`);
    return shellState(title("Sources","GitHub, npm, website, and map-custody sources in one normalized list.",`<button class="button" data-dialog="add-source-dialog">Add source</button>`)+`<div class="filters"><button class="active">All · ${rows.length}</button><button>GitHub</button><button>npm</button><button>Site</button><button>Map custody</button><button>Needs attention</button></div>${sourceRows(rows)}`);
  }
  function releases(){
    const rows=list("releases");
    return shellState(title("Releases","Compact append-only ledger with receipt, delivery, attestation, approval, and hold compositions.",`<button class="button secondary" data-dialog="action-dialog">Export ledger</button>`)+(rows.length?`<div class="card">${rows.map(r=>`<div class="list-row"><span><strong>${esc(r.coordinate)}</strong><div class="meta">${esc(r.channel)} · ${fmt(r.createdAt)}</div></span><span class="meta">${esc(String(r.artifactSha256||"").slice(0,12))}${r.artifactSha256?"…":"Digest unavailable"}</span>${statusBadge(r.receiptStatus||"Unknown")}<button class="button ghost" data-dialog="release-dialog" data-release="${r.id}">Receipt</button></div>`).join("")}</div>`:empty("No releases returned","Receipt and governance structures remain empty until the API returns revisions.")));
  }
  function timeline(){
    const alerts=list("alerts"), sources=allSources();
    return shellState(title("Timeline","True retained-window source lanes from returned alert and source timestamps.")+exposureChart(alerts,sources)+`<section class="section"><h2>Event feed</h2><div class="card section">${alerts.length?alerts.map(a=>`<div class="list-row"><span><strong>${esc(a.title)}</strong><div class="meta">${esc(a.kind)}</div></span><span></span><time class="meta">${fmt(a.created_at)}</time>${statusBadge(a.resolved_at?"Resolved":"Open")}</div>`).join(""):`<div class="empty-state">No timeline events returned.</div>`}</div></section>`);
  }
  function setup(){
    const me=state.data?.me, repos=list("repos"), packages=list("packages"), origins=list("origins"), maps=list("map-destinations"), releases=list("releases");
    const steps=[["Repository visibility",repos.length?"Confirmed":"Incomplete"],["Packed workflow / release assets",releases.length?"Confirmed":repos.length?"Check needed":"Incomplete"],["Registry tarballs",packages.length?"Confirmed":"Incomplete"],["Production origin",origins.length?"Confirmed":"Incomplete"],["Map custody",maps.length?"Confirmed":"Check needed"]];
    const done=steps.filter(x=>x[1]==="Confirmed").length;
    return shellState(title("Guided setup",`${done} of 5 leak paths confirmed from current read-only data.`)+`<div class="card">${steps.map((x,i)=>`<div class="setup-step ${x[1]!=="Confirmed"&&!steps.slice(0,i).some(y=>y[1]!=="Confirmed")?"next":""}"><span class="step-index">${i+1}</span><span><strong>${x[0]}</strong><div class="meta">${x[1]==="Check needed"?"Status is unknown; a check is needed.":x[1]}</div>${x[1]!=="Confirmed"&&!steps.slice(0,i).some(y=>y[1]!=="Confirmed")?`<p class="lede">Next suggested action is presented here without submitting changes.</p>`:""}</span>${x[1]!=="Confirmed"?`<button class="button secondary" data-dialog="action-dialog">Preview setup</button>`:statusBadge("Confirmed")}</div>`).join("")}</div>`);
  }
  function settings(route){
    const configs={
      notifications:["Destinations and routes",[["Destinations",list("destinations").length],["Routes",list("destinations/routes").length]],"add-destination-dialog"],
      policy:["Signing, baselines, exceptions",[["Exceptions",list("exceptions").length],["Signing policy",state.data?.["signing-policy:raw"]?"Available":"Unavailable"]],"action-dialog"],
      team:["People, roles, and gates",[["Members",list("members").length],["Your role",state.data?.me?.installations?.[0]?.role||"Unknown"]],"invite-dialog"],
      retention:["Retention window",[["Current value",state.data?.["retention:raw"]?.days!=null?`${state.data["retention:raw"].days} days`:"Unavailable"]],"action-dialog"],
      audit:["Audit trail",[["Events",list("audit").length]],"action-dialog"],
      health:["Installation health",[["Webhook",state.data?.me?.installations?.[0]?.lastPermissionTest?.lastDelivery?.status||"Unknown"],["Permissions",state.data?.me?.installations?.[0]?.lastPermissionTest?.ok?"Pass":"Check needed"],["Queue",state.data?.["jobs:raw"]?.summary?.queued??"Unknown"],["Fair use",state.data?.["jobs:raw"]?.fairUse?.exhausted?"Paused":state.data?.["jobs:raw"]?.fairUse?"OK":"Unknown"]],"action-dialog"],
      tokens:["Scan API tokens",[["Tokens",list("scan-tokens").length]],"token-dialog"],
      registries:["Private registries",[["Registries",list("registries").length]],"registry-dialog"]
    };
    const [heading,items,overlay]=configs[route];
    const detail=route==="notifications"?notificationCards():route==="team"?teamRows():route==="audit"?auditRows():route==="tokens"?tokenRows():route==="registries"?registryRows():"";
    return shellState(title(labels[route],heading,`<button class="button" data-dialog="${overlay}">${route==="health"?"Test":route==="audit"?"Export":"Open design dialog"}</button>`)+`<div class="grid settings-grid">${items.map(([k,v])=>`<section class="card setting-card"><div class="eyebrow">${esc(k)}</div><div class="metric-value">${esc(v)}</div><div class="meta">Current GET response</div></section>`).join("")}</div>${detail}`);
  }
  function notificationCards(){const rows=list("destinations");return `<section class="section"><h2>Destination cards</h2>${rows.length?`<div class="grid settings-grid section">${rows.map(x=>`<div class="card setting-card"><strong>${esc(x.kind)}</strong><p class="meta">${esc(x.host||"Host not returned")}</p><div class="section">${statusBadge(x.lastDeliveryStatus||"No delivery status")}</div></div>`).join("")}</div>`:empty("No destinations returned","Routes and tests are not simulated as completed.")}</section>`}
  function teamRows(){const rows=list("members");return `<section class="section"><h2>People</h2>${rows.length?`<div class="card">${rows.map(x=>`<div class="list-row"><span class="row"><span class="avatar"></span><strong>${esc(x.login||x.githubLogin||"Login unavailable")}</strong></span><span></span><span></span>${statusBadge(x.role||"Unknown")}</div>`).join("")}</div>`:empty("No member rows returned","No users or invites are invented.")}</section>`}
  function auditRows(){const rows=list("audit");return `<section class="section"><h2>Audit events</h2>${rows.length?`<div class="card">${rows.map(x=>`<div class="list-row"><span><strong>${esc(x.action||x.kind||"Event")}</strong><div class="meta">${esc(x.actor_login||x.actorLogin||"Actor unavailable")}</div></span><span></span><time class="meta">${fmt(x.created_at||x.createdAt)}</time><span></span></div>`).join("")}</div>`:empty("No audit events returned","No activity is implied.")}</section>`}
  function tokenRows(){const rows=list("scan-tokens");return `<section class="section"><h2>Token rows</h2>${rows.length?`<div class="card">${rows.map(x=>`<div class="list-row"><span><strong>${esc(x.name)}</strong><div class="meta">${esc(x.token_prefix)}…</div></span><span></span><span class="meta">${age(x.last_used_at)}</span><button class="button danger" data-dialog="token-dialog">Revoke</button></div>`).join("")}</div>`:empty("No tokens returned","Secret values are never requested or displayed.")}</section>`}
  function registryRows(){return `<section class="section"><h2>Saved registries</h2>${sourceRows(list("registries").map(x=>({_name:x.host,_type:"Private registry",_status:"Saved",_time:x.updated_at,id:x.id})))}</section>`}
  function render(){
    app.dataset.preview=state.preview; nav.innerHTML=navMarkup();
    const install=state.data?.me?.installations?.[0]; document.querySelector("#install-name").textContent=install?.account_login||"Installation"; document.querySelector("#coverage-label").textContent=state.status==="signed-out"?"Sign in required":install?.plan||install?.role||"Checking access…"; document.querySelector("#coverage-top").textContent=install?.plan||"Coverage";
    const count=([list("repos"),list("releases"),list("packages"),list("origins"),list("map-destinations")].filter(x=>x.length).length); document.querySelector("#mini-ring").textContent=state.status==="ready"||state.status==="partial"?`${count}/5`:"—"; document.querySelector("#mini-setup").textContent=state.status==="ready"||state.status==="partial"?`${count} paths have data`:"Checking coverage…";
    const page=state.route==="overview"?overview():state.route==="alerts"?alerts():state.route==="sources"?sources():state.route==="releases"?releases():state.route==="timeline"?timeline():state.route==="setup"?setup():settings(state.route);
    main.innerHTML=page; document.title=`${labels[state.route]} · Premium Watch prototype`;
  }
  const dialogTemplates={
    "install-dialog":()=>`<h2 id="dialog-title">Installation picker</h2><p class="lede">Real installations from the authenticated session.</p>${(state.data?.me?.installations||[]).map(x=>`<button class="palette-item"><span>${esc(x.account_login)}</span><span>${esc(x.role||"Unknown role")}</span></button>`).join("")||`<div class="empty-state">No installations returned.</div>`}`,
    "account-dialog":()=>`<h2 id="dialog-title">Account &amp; coverage</h2><p class="lede">${esc(state.data?.me?.user?.login||"Not signed in")}</p><div class="dialog-note">Design preview — no changes are made.</div>`,
    "notes-dialog":()=>`<h2 id="dialog-title">Design notes</h2><div class="notes"><div><b>Shell</b><span>2B architecture + 01 Work/Evidence/Configure grouping</span></div><div><b>Overview</b><span>05/1A verdict-first + 09 weighted metrics</span></div><div><b>Alerts</b><span>03/1C triage; mobile list → detail</span></div><div><b>Sources</b><span>06/2D object detail</span></div><div><b>Timeline</b><span>08/1B source-lane exposure</span></div><div><b>Setup</b><span>10/1G guided sequence</span></div><div><b>Settings</b><span>07/1I row discipline without a hard Desk split</span></div><div><b>Mobile</b><span>2C secondary tab pattern</span></div></div>`,
    "palette":()=>paletteMarkup(),
    "add-source-dialog":()=>`<h2 id="dialog-title">Add a source</h2><div class="dialog-note">Design preview — no changes are made.</div><label>Source type<select><option>Choose a type…</option><option>GitHub repository</option><option>npm package</option><option>Production site</option><option>Map custody</option></select></label><p class="lede">After choosing a type, one focused form replaces this chooser.</p><button class="button" disabled>Continue</button>`,
    "assign-dialog":()=>previewDialog("Assign alert","Choose a real member from the current installation. This prototype does not submit."),
    "resolve-dialog":()=>previewDialog("Resolve alert","Add a resolution note and review the exposure clock before submitting in the future production UI."),
    "release-dialog":()=>previewDialog("Release detail","Receipt, delivery locations, attestations, public verification, approval, and legal-hold controls compose here from the selected real release."),
    "add-destination-dialog":()=>previewDialog("Add notification destination","Choose one destination type, then configure and test it in a focused second step."),
    "invite-dialog":()=>previewDialog("Invite a teammate","GitHub login, role, and permission gate would be reviewed here."),
    "token-dialog":()=>previewDialog("Token action","Create, one-time reveal, or revoke states are represented without generating a secret."),
    "registry-dialog":()=>previewDialog("Private registry","A focused registry host and credential form would appear here."),
    "action-dialog":()=>previewDialog("Action preview","The production action composition would appear here after approval.")
  };
  function previewDialog(heading,text){return `<h2 id="dialog-title">${heading}</h2><div class="dialog-note">Design preview — no changes are made.</div><p class="lede">${text}</p><div class="row section"><button class="button" disabled>Confirm</button><button class="button secondary" data-close-dialog>Cancel</button></div>`}
  function paletteMarkup(){const recent=["overview","alerts","sources"], routes=groups.flatMap(x=>x[1]);return `<h2 id="dialog-title">Command palette</h2><input id="palette-search" type="search" placeholder="Search screens and actions" autocomplete="off"><div class="palette-group"><div class="eyebrow">Recent</div>${recent.map(r=>paletteItem(r,labels[r])).join("")}</div><div class="palette-group"><div class="eyebrow">Jump</div>${routes.map(([r,l])=>paletteItem(r,l)).join("")}</div><div class="palette-group"><div class="eyebrow">Do</div><button class="palette-item" data-dialog="add-source-dialog"><span>Add a source</span><span>Preview</span></button><button class="palette-item" data-dialog="action-dialog"><span>Run install test</span><span>Preview</span></button></div><p class="meta section">↑ ↓ navigate · Home End jump · Enter open · Escape close</p>`}
  function paletteItem(route,label){return `<button class="palette-item" data-route="${route}"><span>${label}</span><span>Jump</span></button>`}
  function openDialog(kind,trigger){
    state.lastFocus=trigger||document.activeElement; dialogContent.innerHTML=(dialogTemplates[kind]||dialogTemplates["action-dialog"])(); dialog.classList.toggle("palette-dialog",kind==="palette"); layer.hidden=false; app.inert=true; app.setAttribute("aria-hidden","true"); state.paletteIndex=0;
    requestAnimationFrame(()=>{ const focus=dialog.querySelector("input,select,button:not(.dialog-close)")||dialog; focus.focus(); updatePalette(); });
  }
  function closeDialog(){layer.hidden=true; app.inert=false; app.removeAttribute("aria-hidden"); state.lastFocus?.focus(); }
  function updatePalette(){const items=[...dialog.querySelectorAll(".palette-item:not([hidden])")];items.forEach((x,i)=>x.classList.toggle("active",i===state.paletteIndex));}
  function navigate(route){state.route=route;state.selectedSource=null;if(route!=="alerts")state.selectedAlert=null;location.hash=route;app.classList.remove("menu-open");render();main.focus();}
  document.addEventListener("click",e=>{
    const route=e.target.closest("[data-route]"); if(route){navigate(route.dataset.route);if(!layer.hidden)closeDialog();return}
    const opener=e.target.closest("[data-dialog]");if(opener){openDialog(opener.dataset.dialog,opener);return}
    if(e.target.closest("[data-close-dialog]")){closeDialog();return}
    const alert=e.target.closest("[data-alert]");if(alert){state.selectedAlert=Number(alert.dataset.alert);render();return}
    const source=e.target.closest("[data-source]");if(source){state.selectedSource=source.dataset.source;render();return}
    if(e.target.closest("#back-inbox")){state.selectedAlert=null;render();return}
    if(e.target.closest("#back-sources")){state.selectedSource=null;render();return}
    if(e.target.closest("#menu-button")){app.classList.toggle("menu-open");return}
    if(e.target.closest("#retry"))load();
    const delta=e.target.closest("#previous-alert")?-1:e.target.closest("#next-alert")?1:0;if(delta){const a=list("alerts"),i=a.findIndex(x=>x.id===state.selectedAlert);state.selectedAlert=a[(i+delta+a.length)%a.length].id;render();}
  });
  document.querySelector("#preview-state").addEventListener("change",e=>{state.preview=e.target.value;render()});
  document.addEventListener("input",e=>{if(e.target.id==="palette-search"){const q=e.target.value.toLowerCase();dialog.querySelectorAll(".palette-item").forEach(x=>x.hidden=!x.textContent.toLowerCase().includes(q));state.paletteIndex=0;updatePalette();}});
  document.addEventListener("keydown",e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openDialog("palette",document.activeElement);return}
    if(!layer.hidden){
      if(e.key==="Escape"){e.preventDefault();closeDialog();return}
      const focusables=[...dialog.querySelectorAll("button:not([disabled]):not([hidden]),input:not([disabled]),select:not([disabled]),[tabindex='0']")];
      if(e.key==="Tab"&&focusables.length){const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
      if(!dialog.classList.contains("palette-dialog"))return;
      const items=[...dialog.querySelectorAll(".palette-item:not([hidden])")];if(!items.length)return;
      if(e.key==="ArrowDown"){e.preventDefault();state.paletteIndex=(state.paletteIndex+1)%items.length;updatePalette();items[state.paletteIndex].scrollIntoView({block:"nearest"})}
      if(e.key==="ArrowUp"){e.preventDefault();state.paletteIndex=(state.paletteIndex-1+items.length)%items.length;updatePalette();items[state.paletteIndex].scrollIntoView({block:"nearest"})}
      if(e.key==="Home"){e.preventDefault();state.paletteIndex=0;updatePalette()}
      if(e.key==="End"){e.preventDefault();state.paletteIndex=items.length-1;updatePalette()}
      if(e.key==="Enter"&&document.activeElement.id==="palette-search"){e.preventDefault();items[state.paletteIndex].click()}
      return;
    }
    if(state.route==="alerts"&&["ArrowDown","ArrowUp"].includes(e.key)){const alerts=list("alerts");if(!alerts.length)return;e.preventDefault();const i=alerts.findIndex(x=>x.id===state.selectedAlert);state.selectedAlert=alerts[(i+(e.key==="ArrowDown"?1:-1)+alerts.length)%alerts.length].id;render();}
  });
  window.addEventListener("hashchange",()=>{const r=location.hash.slice(1);if(labels[r]&&r!==state.route){state.route=r;render()}});
  document.querySelector("#shortcut").textContent=/Mac|iPhone|iPad/.test(navigator.platform)?"⌘ K":"Ctrl K";
  render(); load();
})();

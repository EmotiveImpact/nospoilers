import {it,expect,vi} from 'vitest';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {openSql,migrate} from '../src/server/sql.ts';
import {createStore,signSession} from '../src/server/store.ts';
import {listUserWorkspaces} from '../src/server/workspaces.ts';
import {skippedGithubWrites,type GithubPort} from '../src/server/github.ts';
import {processAiReview,queueAiReview,type AiReviewEngine} from '../src/server/ai-review/service.ts';
import {verifyFixesAfterReleaseScan} from '../src/server/fix-verification.ts';
import type {RepoWriter} from '../src/server/fix-pr.ts';
import type {ModelProvider} from '../src/server/ai-review/providers.ts';
import type {Finding} from '../src/scanner/types.ts';

const findings:Finding[]=[
  {rule:'MAP-002',severity:'critical',path:'package/dist/app.js.map',title:'Source map embeds original source',detail:'d'},
  {rule:'SEC-001',severity:'critical',path:'package/.env',title:'Environment file shipped',detail:'d'},
];

it('reviews a release alert, opens a fix PR and marks the alert verified closed after a clean release',async()=>{
  const sql=await openSql('pglite://:memory:');try{
    await migrate(sql);const store=createStore(sql);
    const fail=async():Promise<never>=>{throw new Error('Unexpected GitHub request');};
    const writes:string[]=[];
    const writer:RepoWriter={defaultBranch:async()=>'main',readFile:async p=>({'package.json':'{"name":"app"}','.gitignore':'node_modules\n','.env':'A=1'} as Record<string,string>)[p]??null,
      createBranch:async n=>{writes.push(n);},writeFile:async p=>{writes.push(`write:${p}`);},deleteFile:async p=>{writes.push(`delete:${p}`);},
      findOpenPull:async()=>null,openPull:async()=>({number:12,url:'https://github.com/org1/app/pull/12'})};
    const github:GithubPort={exchangeCode:fail,getUser:fail,listUserInstallations:fail,getInstallation:fail,getRepo:fail,listReleaseAssets:fail,getLatestRelease:fail,downloadAsset:fail,...skippedGithubWrites(),repoWriter:async()=>writer};
    const app=createApp({store,github,config:loadConfig({appBaseUrl:'http://127.0.0.1:4347',sessionSecret:'ai'})});
    for(const id of ['owner','stranger'])await store.upsertUser({id,login:id});
    await store.upsertInstallation({id:1,accountId:1,accountLogin:'org1',accountType:'Organization'});await store.linkUserInstallation(1,'owner');
    await store.upsertRepo({id:5,installationId:1,owner:'org1',name:'app',fullName:'org1/app',private:true,htmlUrl:'https://github.com/org1/app'});
    const workspace=(await listUserWorkspaces(sql,'owner')).find(w=>Number(w.installation_id)===1)!;
    const alertId=await store.insertAlert({installationId:1,repoId:5,kind:'release_scan',title:'Spoilers in org1/app v1',body:'Saved',findings});

    // AI review: queued after evidence is saved, processed with a fake zero-retention provider.
    const reasoning:ModelProvider={id:'fake',model:'fake-reasoning',tier:'reasoning',region:'us',host:'x',zeroDataRetention:true,
      complete:vi.fn(async()=>({text:JSON.stringify({priority:'act_now',summary:'Rotate the env values.',attackerView:'Admin refunds route is public.',
        findings:[{id:1,verdict:'confirmed',impact:'high',explanation:'Source is public.',fix:'Hide maps.'},{id:2,verdict:'confirmed',impact:'high',explanation:'Env is public.',fix:'Delete and rotate.'}],
        surface:[{kind:'route',value:'/admin/refunds',why:'Refunds.'}]}),inputTokens:1,outputTokens:1}))};
    const engine:AiReviewEngine={reasoning,triage:null,dailyReviews:5,timeoutMs:5000};
    const surface={routes:['/admin/refunds'],flags:[],hosts:[],envNames:[],sources:1,truncated:false};
    expect(await queueAiReview(store,engine,{alertId,installationId:1,source:{kind:'release',label:'org1/app v1'},findings,surface})).toBe(true);
    expect(await queueAiReview(store,engine,{alertId,installationId:1,source:{kind:'release',label:'org1/app v1'},findings,surface})).toBe(false);
    expect((await sql.query<{kind:string}>('SELECT kind FROM jobs')).rows.map(r=>r.kind)).toContain('ai_release_review');
    await processAiReview(sql,alertId,engine);

    const headers={cookie:`ns_session=${signSession('ai',await store.createSession('owner'))}`};
    const q=`?workspaceId=${workspace.id}`;
    const review=await (await app.request(`/api/alerts/${alertId}/ai-review${q}`,{headers})).json() as {review:{state:string;result:{priority:string;surface:unknown[]}}};
    expect(review.review.state).toBe('complete');
    expect(review.review.result.priority).toBe('act_now');
    expect(review.review.result.surface).toHaveLength(1);
    const stranger={cookie:`ns_session=${signSession('ai',await store.createSession('stranger'))}`};
    expect((await app.request(`/api/alerts/${alertId}/ai-review`,{headers:stranger})).status).toBe(404);
    expect((await (await store.getAlertForUser(alertId,'owner'))!).resolved_at).toBeNull();

    // Fix PR: deterministic plan, written through the App writer, recorded once.
    const info=await (await app.request(`/api/alerts/${alertId}/fix-pr${q}`,{headers})).json() as {eligible:boolean;kinds:string[]};
    expect(info).toMatchObject({eligible:true,kinds:['source_maps','env_file']});
    expect((await app.request(`/api/alerts/${alertId}/fix-pr${q}`,{method:'POST',headers:{...stranger,origin:'http://127.0.0.1:4347'}})).status).toBe(404);
    const opened=await app.request(`/api/alerts/${alertId}/fix-pr${q}`,{method:'POST',headers:{...headers,origin:'http://127.0.0.1:4347'}});
    expect(opened.status).toBe(201);
    expect(writes).toEqual(['nospoilers/fix-alert-'+alertId,'write:.npmignore','write:.gitignore','delete:.env']);
    expect((await opened.json() as {fix:{number:number;state:string}}).fix).toMatchObject({number:12,state:'open'});

    // A release that still ships maps keeps the alert open; a clean one closes it with evidence.
    expect(await verifyFixesAfterReleaseScan(sql,{repoId:5,tag:'v1.0.1',status:'failed-policy',findings:[findings[0]],alertId:null})).toEqual([{fixId:expect.any(Number),alertId,outcome:'still_present'}]);
    expect(await verifyFixesAfterReleaseScan(sql,{repoId:5,tag:'v1.0.2',status:'inconclusive',findings:[],alertId:null})).toEqual([]);
    expect((await verifyFixesAfterReleaseScan(sql,{repoId:5,tag:'v1.0.3',status:'passed',findings:[],alertId:null}))[0].outcome).toBe('verified_closed');
    const closed=(await store.getAlertForUser(alertId,'owner'))!;
    expect(closed.resolved_by_login).toBe('nospoilers');
    expect(closed.resolution_note).toMatch(/v1\.0\.3/);
    const fix=await (await app.request(`/api/alerts/${alertId}/fix-pr${q}`,{headers})).json() as {fix:{state:string;verifiedTag:string}};
    expect(fix.fix).toMatchObject({state:'verified_closed',verifiedTag:'v1.0.3'});
  }finally{await sql.close();}
},60000);

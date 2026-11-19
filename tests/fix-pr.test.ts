import {it,expect} from 'vitest';
import {fixStillPresent,fixTargets,openFixPullRequest,planFixPr,type RepoWriter} from '../src/server/fix-pr.ts';
import type {Finding} from '../src/scanner/types.ts';

const f=(rule:string,path:string):Finding=>({rule,path,severity:'critical',title:rule,detail:''});
const reader=(files:Record<string,string>)=>async(path:string)=>files[path]??null;

it('adds negations to package.json files, keeping indentation, and hides Vite maps',async()=>{
  const plan=await planFixPr([f('MAP-001','package/dist/app.js.map'),f('BAK-001','package/dist/db.bak')],reader({
    'package.json':'{\n    "name": "x",\n    "files": ["dist"]\n}\n','vite.config.ts':'export default {build:{sourcemap: true}}'}));
  const pkg=plan.changes.find(c=>c.path==='package.json')!;
  expect(JSON.parse(pkg.content!).files).toEqual(['dist','!**/*.map','!dist/db.bak']);
  expect(pkg.content).toMatch(/\n {4}"name"/);
  expect(plan.changes.find(c=>c.path==='vite.config.ts')!.content).toBe("export default {build:{sourcemap: 'hidden'}}");
});

it('seeds a new .npmignore from .gitignore so nothing extra starts shipping, and deletes a committed .env',async()=>{
  const plan=await planFixPr([f('SEC-001','package/.env'),f('SEC-001','package/.env.example')],reader({'package.json':'{"name":"x"}','.gitignore':'node_modules\n','.env':'A=1','.env.example':'A='}));
  const npmignore=plan.changes.find(c=>c.path==='.npmignore')!.content!;
  expect(npmignore).toMatch(/node_modules/);
  expect(npmignore).toMatch(/\*\*\/\.env\n/);
  expect(plan.changes.filter(c=>c.action==='delete').map(c=>c.path)).toEqual(['.env']);
  expect(plan.changes.find(c=>c.path==='.gitignore')!.content).toMatch(/!\.env\.example/);
  expect(plan.notes.join(' ')).toMatch(/Rotate/);
});

it('reports rules it cannot fix and plans nothing when nothing applies',async()=>{
  expect(fixTargets([f('NET-001','dist/a.js'),f('LNK-001','x')]).unfixable).toEqual(['LNK-001','NET-001']);
  expect((await planFixPr([f('NET-001','dist/a.js')],reader({}))).changes).toEqual([]);
});

it('opens one branch and pull request through the writer and reuses an open one',async()=>{
  const writes:string[]=[];let pulls=0;
  const writer:RepoWriter={defaultBranch:async()=>'main',readFile:async p=>p==='package.json'?'{"name":"x","files":["dist"]}':null,
    createBranch:async name=>{writes.push(`branch:${name}`);},writeFile:async p=>{writes.push(`write:${p}`);},deleteFile:async p=>{writes.push(`delete:${p}`);},
    findOpenPull:async()=>pulls?{number:7,url:'https://github.com/a/b/pull/7'}:null,
    openPull:async input=>{pulls++;expect(input.body).toMatch(/never merged automatically/);return {number:7,url:'https://github.com/a/b/pull/7'};}};
  const first=await openFixPullRequest(writer,{id:42,title:'Spoilers in a/b v1',findings:[f('MAP-001','package/dist/a.js.map')]});
  expect(first).toMatchObject({ok:true,number:7,existing:false});
  expect(writes).toEqual(['branch:nospoilers/fix-alert-42','write:package.json']);
  expect(await openFixPullRequest(writer,{id:42,title:'t',findings:[f('MAP-001','package/dist/a.js.map')]})).toMatchObject({existing:true});
});

it('treats a fix as still present only when a targeted finding comes back',()=>{
  const {targets}=fixTargets([f('MAP-002','package/dist/a.js.map'),f('BAK-001','package/x.bak')]);
  expect(fixStillPresent(targets,[])).toBe(false);
  expect(fixStillPresent(targets,[f('MAP-001','package/dist/b.js.map')])).toBe(true);
  expect(fixStillPresent(targets,[f('BAK-001','package/other.bak')])).toBe(false);
  expect(fixStillPresent(targets,[f('BAK-001','package/x.bak')])).toBe(true);
});

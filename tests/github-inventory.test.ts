import {afterEach,it,expect,vi} from 'vitest';
import {generateKeyPairSync} from 'node:crypto';
import {createGithubPort} from '../src/server/github.ts';
import {loadConfig} from '../src/server/config.ts';

afterEach(()=>vi.unstubAllGlobals());
const repository=(id:number)=>({id,name:`repo${id}`,full_name:`org/repo${id}`,owner:{login:'org'},private:true,html_url:`https://github.com/org/repo${id}`});
const port=()=>createGithubPort(loadConfig({githubAppId:'123',githubPrivateKey:generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'}).toString()}));
it('lists every page with an installation token and never follows supplied links',async()=>{
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/access_tokens'))return Response.json({token:'installation-test',expires_at:new Date(Date.now()+3600_000).toISOString()});
  expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer installation-test');
  expect(init?.redirect).toBe('error');
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  return Response.json({total_count:101,repositories:url.endsWith('page=1')?Array.from({length:100},(_,i)=>repository(i+1)):[repository(101)]},{headers:{link:'<https://untrusted.invalid>; rel="next"'}});
 });vi.stubGlobal('fetch',fetcher);
 expect(await port().listInstallationRepositories!(7)).toHaveLength(101);
 expect(fetcher.mock.calls.map(([url])=>url)).toEqual(['https://api.github.com/app/installations/7/access_tokens','https://api.github.com/installation/repositories?per_page=100&page=1','https://api.github.com/installation/repositories?per_page=100&page=2']);
});
it('paginates user installations rather than stopping at the first page',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json({total_count:101,installations:url.endsWith('page=1')?Array.from({length:100},(_,i)=>({id:i+1})):[{id:101}]})));
 expect(await port().listUserInstallations('user-token')).toHaveLength(101);
});
it('rejects duplicate, short, oversized and changing inventories rather than returning partial access',async()=>{
 for(const second of [
  {total_count:101,installations:[{id:1}]},
  {total_count:101,installations:[]},
  {total_count:102,installations:[{id:101},{id:102}]},
  {total_count:10001,installations:[]},
 ]){
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.endsWith('page=1')?{total_count:101,installations:Array.from({length:100},(_,i)=>({id:i+1}))}:second)));
  await expect(port().listUserInstallations('user-token')).rejects.toThrow(/GitHub/);
 }
});
it('fails on later page errors and accepts a genuinely empty inventory',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('page=1')?Response.json({total_count:101,installations:Array.from({length:100},(_,i)=>({id:i+1}))}):new Response('denied',{status:403})));
 await expect(port().listUserInstallations('user-token')).rejects.toMatchObject({status:403});
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({total_count:0,installations:[]})));
 expect(await port().listUserInstallations('user-token')).toEqual([]);
});
it('rejects invalid repository metadata and installation IDs before exposing inventory',async()=>{
 const fetcher=vi.fn(async(url:string)=>Response.json(url.endsWith('/access_tokens')?{token:'installation-test',expires_at:new Date(Date.now()+3600_000).toISOString()}:{total_count:1,repositories:[{id:1}]}));
 vi.stubGlobal('fetch',fetcher);const github=port();
 await expect(github.listInstallationRepositories!(-1)).rejects.toThrow('Invalid');expect(fetcher).not.toHaveBeenCalled();
 await expect(github.listInstallationRepositories!(7)).rejects.toThrow('invalid repository');
});

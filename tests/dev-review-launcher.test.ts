import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {disabledReviewProviders,reviewRequest,reviewResponse,isReviewProviderPath} from '../scripts/dev-review-isolation.ts';

it('rejects explicit dev review in production before opening a database or server',()=>{
  let output='';
  try{execFileSync(process.execPath,['--import','tsx','scripts/gate-b-browser-fixture.ts','--dev-review'],{env:{...process.env,NODE_ENV:'production'},stdio:'pipe',timeout:30000});}
  catch(error){output=String((error as {stderr:unknown}).stderr);}
  expect(output).toContain('Dev review cannot run in production.');
});
it('translates only the dedicated review cookie, never the normal localhost session',()=>{
 const request=reviewRequest(new Request('http://localhost:4372/api/me',{headers:{cookie:'ns_session=customer; ns_dev_review_session=synthetic; other=private'}}));
 expect(request.headers.get('cookie')).toBe('ns_session=synthetic');
 expect(reviewRequest(new Request('http://localhost:4372/api/me',{headers:{cookie:'ns_session=customer'}})).headers.get('cookie')).toBeNull();
});
it('translates session deletion without clearing the real localhost cookie',()=>{
 const headers=new Headers();headers.append('set-cookie','ns_session=; Path=/; Max-Age=0');headers.append('set-cookie','github_oauth_state=test');
 const response=reviewResponse(new Response(null,{headers}),'http://localhost:4372');
 expect(response.headers.getSetCookie()).toEqual(['ns_dev_review_session=; Path=/; Max-Age=0']);
});
it('rejects external redirects and provider entry paths but preserves same-origin logout redirects',()=>{
 expect(reviewResponse(new Response(null,{status:302,headers:{location:'https://github.com/login/oauth/authorize'}}),'http://localhost:4372').status).toBe(409);
 expect(reviewResponse(new Response(null,{status:302,headers:{location:'/watch'}}),'http://localhost:4372').headers.get('location')).toBe('/watch');
 for(const path of ['/api/auth/github','/api/auth/github/callback','/api/auth/development','/api/github/install','/auth/login'])expect(isReviewProviderPath(path)).toBe(true);
 expect(isReviewProviderPath('/api/auth/logout')).toBe(false);
});
it('explicitly clears provider and administrator capabilities instead of inheriting environment values',()=>{
 for(const [key,value] of Object.entries(disabledReviewProviders))if(!['databaseUrl','processRole'].includes(key))expect(value).toBe('');
 expect(disabledReviewProviders.databaseUrl).toBe('pglite://:memory:');
 expect(disabledReviewProviders.processRole).toBe('web');
});
it('keeps the opt-in launcher separate from production start and deployment commands',()=>{
  const {scripts}=JSON.parse(readFileSync('package.json','utf8'));
  expect(scripts['dev:review']).toBe('npm run build && tsx scripts/gate-b-browser-fixture.ts --dev-review');
  for(const name of ['start','host','build:vercel'])expect(scripts[name]).not.toContain('dev-review');
});

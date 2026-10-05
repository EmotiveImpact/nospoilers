import {describe,expect,it,vi} from 'vitest';
import {createApp} from '../src/server/app.ts';
import {loadConfig} from '../src/server/config.ts';
import {skippedGithubWrites,type GithubPort} from '../src/server/github.ts';
import {
 createBetterAuthHttpProvider,emailAccountName,emailAuthConfig,emailAuthConfigurationProblems,emailResetHint,readEmailResetHint,
 type EmailAuthProvider,type EmailAuthResult,type EmailAuthUser,
} from '../src/server/product-email-auth.ts';
import {migrate,openSql} from '../src/server/sql.ts';
import {createStore,type Store} from '../src/server/store.ts';

const AUTH='https://ep-quiet.neonauth.eu-west-2.aws.neon.tech/neondb/auth';
const APP='http://127.0.0.1:8787';

describe('email sign-in configuration',()=>{
 it('stays off unless explicitly selected',()=>{
  expect(emailAuthConfig({})).toBeNull();
  expect(emailAuthConfigurationProblems({})).toEqual([]);
  expect(emailAuthConfig({NEON_AUTH_BASE_URL:AUTH})).toBeNull();
 });

 it('accepts only an HTTPS Auth base URL and normalises it as the issuer',()=>{
  expect(emailAuthConfig({NOSPOILERS_EMAIL_AUTH:'neon-better-auth',NEON_AUTH_BASE_URL:`${AUTH}/`}))
   .toEqual({baseUrl:AUTH,issuer:AUTH});
  for(const bad of ['http://neon.example/auth','not a url','https://user:pass@neon.example/auth','https://neon.example/auth?x=1'])
   expect(emailAuthConfigurationProblems({NOSPOILERS_EMAIL_AUTH:'neon-better-auth',NEON_AUTH_BASE_URL:bad})).toHaveLength(1);
  expect(emailAuthConfigurationProblems({NOSPOILERS_EMAIL_AUTH:'workos'})).toEqual([expect.stringContaining('neon-better-auth')]);
 });
});

describe('Better Auth HTTP provider',()=>{
 function respond(status:number,body:unknown){
  const calls:{url:string;init:RequestInit}[]=[];
  const fetch=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
   calls.push({url:String(url),init:init!});
   return new Response(typeof body==='string'?body:JSON.stringify(body),{status});
  }) as unknown as typeof globalThis.fetch;
  return {calls,provider:createBetterAuthHttpProvider({baseUrl:AUTH,appOrigin:APP,fetch})};
 }

 it('signs in server to server with the app origin and returns the trusted user',async()=>{
  const {calls,provider}=respond(200,{token:'discarded',user:{id:'user-1',name:'Ada',email:'ada@example.com',emailVerified:true}});
  await expect(provider.signIn({email:'ada@example.com',password:'correct horse'}))
   .resolves.toEqual({ok:true,value:{id:'user-1',name:'Ada',emailVerified:true}});
  expect(calls[0]!.url).toBe(`${AUTH}/sign-in/email`);
  expect(calls[0]!.init.method).toBe('POST');
  expect(calls[0]!.init.redirect).toBe('manual');
  expect((calls[0]!.init.headers as Record<string,string>).origin).toBe(APP);
  expect(JSON.parse(String(calls[0]!.init.body))).toEqual({email:'ada@example.com',password:'correct horse',rememberMe:false});
 });

 it('uses the documented sign-up and password reset endpoints',async()=>{
  const signUp=respond(200,{user:{id:'user-2',name:'Bo',emailVerified:false}});
  await expect(signUp.provider.signUp({name:'Bo',email:'bo@example.com',password:'longenough',callbackURL:`${APP}/watch?verified=1`}))
   .resolves.toMatchObject({ok:true,value:{emailVerified:false}});
  expect(signUp.calls[0]!.url).toBe(`${AUTH}/sign-up/email`);
  const request=respond(200,{status:true});
  await expect(request.provider.requestPasswordReset({email:'bo@example.com',redirectTo:`${APP}/watch/reset-password`})).resolves.toEqual({ok:true,value:null});
  expect(request.calls[0]!.url).toBe(`${AUTH}/request-password-reset`);
  const reset=respond(200,{status:true});
  await expect(reset.provider.resetPassword({token:'t',newPassword:'longenough'})).resolves.toEqual({ok:true,value:null});
  expect(reset.calls[0]!.url).toBe(`${AUTH}/reset-password`);
 });

 it('maps provider error codes and statuses without leaking provider text',async()=>{
  const cases:[number,unknown,string][]=[
   [401,{code:'INVALID_EMAIL_OR_PASSWORD',message:'x'},'invalid_credentials'],
   [403,{code:'EMAIL_NOT_VERIFIED'},'email_unverified'],
   [422,{code:'USER_ALREADY_EXISTS'},'account_exists'],
   [400,{code:'PASSWORD_TOO_SHORT'},'weak_password'],
   [400,{code:'INVALID_TOKEN'},'invalid_token'],
   [401,'not json','invalid_credentials'],
   [500,{message:'boom'},'unavailable'],
  ];
  for(const [status,body,reason] of cases)
   await expect(respond(status,body).provider.signIn({email:'a@b.c',password:'p'})).resolves.toEqual({ok:false,reason});
 });

 it('treats a success without a usable user, or a network failure, as unavailable',async()=>{
  await expect(respond(200,{user:{name:'no id'}}).provider.signIn({email:'a@b.c',password:'p'})).resolves.toEqual({ok:false,reason:'unavailable'});
  const offline=createBetterAuthHttpProvider({baseUrl:AUTH,appOrigin:APP,fetch:(async()=>{throw new TypeError('fetch failed');}) as typeof fetch});
  await expect(offline.signIn({email:'a@b.c',password:'p'})).resolves.toEqual({ok:false,reason:'unavailable'});
 });
});

describe('email account names',()=>{
 it('can never collide with a GitHub login and stay stable per identity',()=>{
  const name=emailAccountName(AUTH,'user-1','EmotiveImpact');
  expect(name).toMatch(/^emotiveimpact~[0-9a-f]{6}$/);
  expect(name).not.toMatch(/^[a-z0-9-]+$/i);
  expect(emailAccountName(AUTH,'user-1','Renamed')).toMatch(new RegExp(`~${name.split('~')[1]}$`));
  expect(emailAccountName(AUTH,'user-2','EmotiveImpact')).not.toBe(name);
  expect(emailAccountName(AUTH,'user-1','  ')).toMatch(/^member~/);
 });
});

type Accounts=Record<string,{password:string;user:EmailAuthUser}>;

function fakeProvider(accounts:Accounts){
 const calls:{method:string;input:Record<string,unknown>}[]=[];
 const provider:EmailAuthProvider={
  async signUp(input){
   calls.push({method:'signUp',input});
   if(accounts[input.email])return {ok:false,reason:'account_exists'};
   const user={id:`sub-${Object.keys(accounts).length+1}`,name:input.name,emailVerified:false};
   accounts[input.email]={password:input.password,user};
   return {ok:true,value:user};
  },
  async signIn(input):Promise<EmailAuthResult<EmailAuthUser>>{
   calls.push({method:'signIn',input});
   const account=accounts[input.email];
   if(!account||account.password!==input.password)return {ok:false,reason:'invalid_credentials'};
   return {ok:true,value:account.user};
  },
  async requestPasswordReset(input){calls.push({method:'requestPasswordReset',input});return {ok:true,value:null};},
  async resetPassword(input){
   calls.push({method:'resetPassword',input});
   // `good:<email>` stands in for a real emailed token for that account.
   const [kind,email]=input.token.split(':');
   if(kind!=='good')return {ok:false,reason:'invalid_token'};
   if(email&&accounts[email])accounts[email].password=input.newPassword;
   return {ok:true,value:null};
  },
 };
 return {provider,calls};
}

const github:GithubPort={
 ...skippedGithubWrites(),
 exchangeCode:async()=>{throw new Error('unused');},getUser:async()=>{throw new Error('unused');},
 listUserInstallations:async()=>[],getInstallation:async()=>{throw new Error('unused');},getRepo:async()=>{throw new Error('unused');},
 listReleaseAssets:async()=>[],getLatestRelease:async()=>null,downloadAsset:async()=>{throw new Error('unused');},
} as GithubPort;

async function withApp(run:(ctx:{store:Store;app:ReturnType<typeof createApp>;accounts:Accounts;calls:ReturnType<typeof fakeProvider>['calls'];issuer:string})=>Promise<void>,options:{enabled?:boolean;issuer?:string}={}){
 const sql=await openSql('pglite://:memory:');
 try {
  await migrate(sql);
  const store=createStore(sql);
  const accounts:Accounts={};
  const {provider,calls}=fakeProvider(accounts);
  const issuer=options.issuer??AUTH;
  const app=createApp({
   config:loadConfig({sessionSecret:'session-secret-for-tests',appBaseUrl:APP,adminGithubLogin:'EmotiveImpact'}),
   store,github,
   emailAuth:options.enabled===false?null:{issuer,provider},
  });
  await run({store,app,accounts,calls,issuer});
 } finally {
  await sql.close();
 }
}

function post(app:ReturnType<typeof createApp>,path:string,body:unknown,headers:Record<string,string>={}){
 return app.request(`${APP}${path}`,{method:'POST',headers:{'content-type':'application/json',origin:APP,...headers},body:JSON.stringify(body)});
}

function sessionCookie(response:Response):string {
 const cookie=response.headers.get('set-cookie')??'';
 const match=/ns_session=[^;]+/.exec(cookie);
 if(!match)throw new Error('No session cookie was set.');
 return match[0];
}

describe('email sign-in routes',()=>{
 it('are absent and advertised as off when email sign-in is not configured',async()=>{
  await withApp(async({app})=>{
   expect((await post(app,'/api/auth/email/sign-in',{email:'a@b.co',password:'longenough'})).status).toBe(404);
   expect(await (await app.request(`${APP}/api/me`)).json()).toMatchObject({user:null,emailAuth:false});
  },{enabled:false});
 });

 it('requires a verified email before creating a session, then signs in as a stable product user',async()=>{
  await withApp(async({app,accounts,store,issuer})=>{
   expect(await (await app.request(`${APP}/api/me`)).json()).toMatchObject({emailAuth:true});
   const signUp=await post(app,'/api/auth/email/sign-up',{name:'Ada Lovelace',email:'ada@example.com',password:'analytical'});
   expect(signUp.status).toBe(202);
   expect(await signUp.json()).toEqual({status:'verify_email'});
   expect(signUp.headers.get('set-cookie')).toBeNull();

   const unverified=await post(app,'/api/auth/email/sign-in',{email:'ada@example.com',password:'analytical'});
   expect(unverified.status).toBe(403);
   expect(await unverified.json()).toMatchObject({code:'email_unverified'});

   accounts['ada@example.com']!.user.emailVerified=true;
   const signedIn=await post(app,'/api/auth/email/sign-in',{email:'ada@example.com',password:'analytical'});
   expect(signedIn.status).toBe(200);
   expect(await signedIn.json()).toEqual({ok:true,redirect:'/watch'});
   const me=await (await app.request(`${APP}/api/me`,{headers:{cookie:sessionCookie(signedIn)}})).json() as {user:{id:string;login:string}};
   expect(me.user.login).toBe(emailAccountName(issuer,'sub-1','Ada Lovelace'));

   const again=await post(app,'/api/auth/email/sign-in',{email:'ada@example.com',password:'analytical'});
   const meAgain=await (await app.request(`${APP}/api/me`,{headers:{cookie:sessionCookie(again)}})).json() as {user:{id:string}};
   expect(meAgain.user.id).toBe(me.user.id);
   const {rows}=await store.sql.query('SELECT issuer,subject,user_id FROM product_auth_identities');
   expect(rows).toEqual([{issuer,subject:'sub-1',user_id:me.user.id}]);
   const {rows:users}=await store.sql.query<{plan:string}>('SELECT plan FROM users WHERE id=$1',[me.user.id]);
   expect(users[0]?.plan).toBe('trial');
  });
 });

 it('never treats an email user as the owner because of a chosen display name',async()=>{
  await withApp(async({app,accounts})=>{
   accounts['owner-lookalike@example.com']={password:'longenough',user:{id:'sub-x',name:'EmotiveImpact',emailVerified:true}};
   const signedIn=await post(app,'/api/auth/email/sign-in',{email:'owner-lookalike@example.com',password:'longenough'});
   const cookie=sessionCookie(signedIn);
   const me=await (await app.request(`${APP}/api/me`,{headers:{cookie}})).json() as {user:{login:string}};
   expect(me.user.login.toLowerCase()).not.toBe('emotiveimpact');
   expect((await app.request(`${APP}/api/internal/operators`,{headers:{cookie}})).status).toBe(401);
  });
 });

 it('keeps identities from different Auth projects apart even with the same subject',async()=>{
  let firstUser='';
  await withApp(async({app,accounts,store})=>{
   accounts['ada@example.com']={password:'analytical',user:{id:'same-subject',name:'Ada',emailVerified:true}};
   await post(app,'/api/auth/email/sign-in',{email:'ada@example.com',password:'analytical'});
   const {rows}=await store.sql.query<{user_id:string}>('SELECT user_id FROM product_auth_identities');
   firstUser=rows[0]!.user_id;
   const other=createApp({
    config:loadConfig({sessionSecret:'session-secret-for-tests',appBaseUrl:APP}),store,github,
    emailAuth:{issuer:'https://other.neonauth.example/neondb/auth',provider:fakeProvider({'ada@example.com':{password:'analytical',user:{id:'same-subject',name:'Ada',emailVerified:true}}}).provider},
   });
   await post(other,'/api/auth/email/sign-in',{email:'ada@example.com',password:'analytical'});
   const {rows:after}=await store.sql.query<{user_id:string}>('SELECT user_id FROM product_auth_identities ORDER BY created_at');
   expect(after).toHaveLength(2);
   expect(after[1]!.user_id).not.toBe(firstUser);
  });
 });

 it('rejects wrong passwords, non-JSON bodies and other origins',async()=>{
  await withApp(async({app,accounts,calls})=>{
   accounts['ada@example.com']={password:'analytical',user:{id:'sub-1',name:'Ada',emailVerified:true}};
   const wrong=await post(app,'/api/auth/email/sign-in',{email:'ada@example.com',password:'guess-guess'});
   expect(wrong.status).toBe(401);
   expect(wrong.headers.get('set-cookie')).toBeNull();
   const form=await app.request(`${APP}/api/auth/email/sign-in`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:APP},body:'email=ada%40example.com&password=analytical'});
   expect(form.status).toBe(415);
   const crossSite=await post(app,'/api/auth/email/sign-in',{email:'ada@example.com',password:'analytical'},{origin:'https://evil.example'});
   expect(crossSite.status).toBe(403);
   expect(calls.filter(call=>call.method==='signIn')).toHaveLength(1);
  });
 });

 it('validates sign-up input before calling the provider',async()=>{
  await withApp(async({app,calls})=>{
   expect((await post(app,'/api/auth/email/sign-up',{name:'',email:'a@b.co',password:'longenough'})).status).toBe(400);
   expect((await post(app,'/api/auth/email/sign-up',{name:'A',email:'not-an-email',password:'longenough'})).status).toBe(400);
   expect((await post(app,'/api/auth/email/sign-up',{name:'A',email:'a@b.co',password:'short'})).status).toBe(400);
   expect(calls).toHaveLength(0);
  });
 });

 it('answers password reset requests identically whether or not an account exists',async()=>{
  await withApp(async({app,calls})=>{
   const response=await post(app,'/api/auth/email/password-reset',{email:'nobody@example.com'});
   expect(response.status).toBe(202);
   expect(await response.json()).toEqual({status:'sent'});
   expect(calls[0]).toEqual({method:'requestPasswordReset',input:{email:'nobody@example.com',redirectTo:`${APP}/watch/reset-password/${emailResetHint('session-secret-for-tests','nobody@example.com')}`}});
   expect((await post(app,'/api/auth/email/reset-password',{token:'bad',password:'longenough'})).status).toBe(400);
   expect(await (await post(app,'/api/auth/email/reset-password',{token:'good',password:'longenough'})).json()).toEqual({status:'reset'});
  });
 });
 it('signs out every older session when a password is reset, then signs the person in',async()=>{
  await withApp(async({app,accounts,store})=>{
   accounts['ada@example.com']={password:'old-password',user:{id:'sub-1',name:'Ada',emailVerified:true}};
   const stolen=sessionCookie(await post(app,'/api/auth/email/sign-in',{email:'ada@example.com',password:'old-password'}));
   expect((await (await app.request(`${APP}/api/me`,{headers:{cookie:stolen}})).json() as {user:unknown}).user).not.toBeNull();

   await post(app,'/api/auth/email/password-reset',{email:'Ada@example.com'});
   const hint=emailResetHint('session-secret-for-tests','ada@example.com');
   const reset=await post(app,'/api/auth/email/reset-password',{token:'good:ada@example.com',password:'new-password',hint});
   expect(await reset.json()).toEqual({ok:true,redirect:'/watch'});
   const fresh=sessionCookie(reset);

   expect((await (await app.request(`${APP}/api/me`,{headers:{cookie:stolen}})).json() as {user:unknown}).user).toBeNull();
   expect((await (await app.request(`${APP}/api/me`,{headers:{cookie:fresh}})).json() as {user:unknown}).user).not.toBeNull();
   const {rows}=await store.sql.query('SELECT id FROM sessions');
   expect(rows).toHaveLength(1);
  });
 });

 it('ignores a forged or missing reset hint and still reports the reset',async()=>{
  await withApp(async({app,accounts,calls})=>{
   accounts['ada@example.com']={password:'old-password',user:{id:'sub-1',name:'Ada',emailVerified:true}};
   expect(readEmailResetHint('session-secret-for-tests',emailResetHint('another-secret','ada@example.com'))).toBeNull();
   const forged=await post(app,'/api/auth/email/reset-password',{token:'good:ada@example.com',password:'new-password',hint:emailResetHint('another-secret','ada@example.com')});
   expect(await forged.json()).toEqual({status:'reset'});
   expect(forged.headers.get('set-cookie')).toBeNull();
   expect(calls.filter(call=>call.method==='signIn')).toHaveLength(0);
  });
 });
});

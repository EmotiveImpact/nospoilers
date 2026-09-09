import type {AppConfig} from '../src/server/config.ts';

export const REVIEW_COOKIE='ns_dev_review_session';
export const disabledReviewProviders:Partial<AppConfig>={
 databaseUrl:'pglite://:memory:',githubAppId:'',githubPrivateKey:'',githubWebhookSecret:'',githubClientId:'',githubClientSecret:'',githubAppSlug:'',githubDiscoveryToken:'',
 adminToken:'',adminGithubLogin:'',stripeSecretKey:'',stripeWebhookSecret:'',stripePriceSoloMonthly:'',stripePriceSoloYearly:'',stripePriceTeamMonthly:'',stripePriceTeamYearly:'',resendApiKey:'',resendFromEmail:'',cronSecret:'',processRole:'web',
};
export function reviewRequest(request:Request):Request{
 const headers=new Headers(request.headers);
 const token=headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${REVIEW_COOKIE}=`))?.slice(REVIEW_COOKIE.length+1);
 headers.delete('cookie');
 if(token)headers.set('cookie',`ns_session=${token}`);
 return new Request(request,{headers});
}
export function reviewResponse(response:Response,base:string):Response{
 const location=response.headers.get('location');
 if(location&&new URL(location,base).origin!==new URL(base).origin)return Response.json({error:'Dev review cannot open external providers. No real GitHub, billing or email connection is available.'},{status:409});
 const headers=new Headers(response.headers);headers.delete('set-cookie');
 for(const cookie of response.headers.getSetCookie()){
  // Do not let fixture sessions or ancillary provider cookies overwrite normal local sessions.
  if(cookie.startsWith('ns_session='))headers.append('set-cookie',cookie.replace(/^ns_session=/,`${REVIEW_COOKIE}=`));
 }
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export function isReviewProviderPath(path:string):boolean{
 return path.startsWith('/auth/')||path.startsWith('/api/auth/github')||path==='/api/auth/development'||path.startsWith('/api/github/install');
}

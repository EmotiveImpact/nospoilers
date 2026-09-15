import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/motion/select';
import './workspace-settings.css';
type Billing={stripe:boolean;billing:{plan:string|null;trialEndsAt:string|null;status:string|null;periodEnd:string|null;hasCustomer:boolean;subscribed:boolean}};

export function OrganizationBilling({id}:{id:string}){
  return <OrganizationBillingScope key={id} id={id}/>;
}
function OrganizationBillingScope({id}:{id:string}){
  const [snapshot,setSnapshot]=useState<{revision:number;data:Billing}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
  const data=snapshot?.revision===retry?snapshot.data:null;
  const [plan,setPlan]=useState('solo'),[interval,setInterval]=useState('month');
  const actionController=useRef<AbortController|null>(null);
  useEffect(()=>()=>actionController.current?.abort(),[]);
  useEffect(()=>{const controller=new AbortController();void fetch(`/api/billing?organizationId=${encodeURIComponent(id)}`,{signal:controller.signal}).then(async response=>{
    const body=await response.json();if(!response.ok)throw new Error(body.error??'Billing could not be loaded.');
    if(!body.billing||typeof body.stripe!=='boolean')throw new Error('Billing could not be loaded.');
    if(!controller.signal.aborted){setSnapshot({revision:retry,data:body});setError('');}
  }).catch(err=>{if(!controller.signal.aborted){setSnapshot(null);setError(err instanceof Error?err.message:'Billing could not be loaded.');}});return()=>controller.abort();},[id,retry]);
  async function open(action:'portal'|'checkout'){
    if(busy||!data?.stripe)return;const controller=new AbortController();actionController.current=controller;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/billing/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:id,plan,interval}),signal:controller.signal});
      const body=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(body.error??'Billing could not be opened.');
      const destination=new URL(body.url);
      if(destination.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(destination.hostname)||destination.username||destination.password)throw new Error('The billing destination was not recognised. Please retry.');
      window.location.assign(destination.href);
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Billing could not be opened.');}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <section className="workspace-billing workspace-organisation-section" aria-label="Organisation billing"><div className="workspace-section-heading"><div><h3>Shared subscription</h3><p>One subscription covers this organisation’s workspaces.</p></div></div>
    {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setRetry(v=>v+1);}}>Retry billing</Button></div>:null}
    {!data&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
    {data?<><dl className="workspace-billing-summary"><div><dt>Current plan</dt><dd>{data.billing.plan??'No active plan'}</dd></div><div><dt>Subscription</dt><dd>{data.billing.subscribed?'Subscribed':data.billing.trialEndsAt&&new Date(data.billing.trialEndsAt)>new Date()?`Trial ends ${new Date(data.billing.trialEndsAt).toLocaleDateString()}`:'Subscription required'}</dd></div></dl>
      {!data.stripe?<p className="workspace-billing-notice" role="status">Billing is not configured on this host. No payment can be taken here.</p>:null}
      {data.billing.hasCustomer?<Button variant="outline" disabled={busy||!data.stripe} onClick={()=>void open('portal')}>Manage subscription</Button>:<form className="workspace-billing-form" onSubmit={event=>{event.preventDefault();void open('checkout');}}><div className="workspace-billing-options"><label>Plan <Select value={plan} onValueChange={setPlan} disabled={busy}><SelectTrigger aria-label="Plan"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="solo">Solo</SelectItem><SelectItem value="team">Team</SelectItem></SelectContent></Select></label><label>Billing interval <Select value={interval} onValueChange={setInterval} disabled={busy}><SelectTrigger aria-label="Billing interval"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="month">Monthly</SelectItem><SelectItem value="year">Yearly</SelectItem></SelectContent></Select></label></div><p className="workspace-form-note">Review the price and terms in secure checkout before subscribing.</p><Button type="submit" disabled={busy||!data.stripe}>{busy?'Opening checkout…':'Continue to secure checkout'}</Button></form>}
      <p className="workspace-form-note">Disconnecting GitHub does not cancel the subscription or restart the trial.</p>
    </>:null}
  </section>;
}

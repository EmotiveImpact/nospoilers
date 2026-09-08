import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
type Billing={stripe:boolean;billing:{plan:string|null;trialEndsAt:string|null;status:string|null;periodEnd:string|null;hasCustomer:boolean;subscribed:boolean}};

export function OrganizationBilling({id}:{id:string}){
  const [data,setData]=useState<Billing|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(false);
  const [plan,setPlan]=useState('solo'),[interval,setInterval]=useState('month');
  useEffect(()=>{const controller=new AbortController();void fetch(`/api/billing?organizationId=${encodeURIComponent(id)}`,{signal:controller.signal}).then(async response=>{
    const body=await response.json();if(!response.ok)throw new Error(body.error??'Billing could not be loaded.');
    if(!body.billing||typeof body.stripe!=='boolean')throw new Error('Billing could not be loaded.');
    if(!controller.signal.aborted){setData(body);setError('');}
  }).catch(err=>{if(!controller.signal.aborted){setData(null);setError(err instanceof Error?err.message:'Billing could not be loaded.');}});return()=>controller.abort();},[id,retry]);
  async function open(action:'portal'|'checkout'){
    if(busy||!data?.stripe)return;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/billing/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:id,plan,interval})});
      const body=await response.json();if(!response.ok)throw new Error(body.error??'Billing could not be opened.');
      const destination=new URL(body.url);
      if(destination.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(destination.hostname)||destination.username||destination.password)throw new Error('The billing destination was not recognised. Please retry.');
      window.location.assign(destination.href);
    }catch(err){setError(err instanceof Error?err.message:'Billing could not be opened.');}finally{setBusy(false);}
  }
  return <section className="watch-empty mt-6" aria-label="Organisation billing"><h3>Shared subscription</h3><p>One subscription covers this organisation’s workspaces. Disconnecting GitHub does not cancel it or restart the trial.</p>
    {error?<div role="alert"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry billing</Button></div>:null}
    {!data&&!error?<p role="status">Loading billing…</p>:null}
    {data?<><p>Plan: {data.billing.plan??'No active plan'} · {data.billing.subscribed?'Subscribed':data.billing.trialEndsAt&&new Date(data.billing.trialEndsAt)>new Date()?`Trial ends ${new Date(data.billing.trialEndsAt).toLocaleDateString()}`:'Subscription required'}</p>
      {!data.stripe?<p role="status">Billing is not configured on this host. No payment can be taken here.</p>:null}
      {data.billing.hasCustomer?<Button variant="outline" disabled={busy||!data.stripe} onClick={()=>void open('portal')}>Manage subscription</Button>:<form onSubmit={event=>{event.preventDefault();void open('checkout');}}><label>Plan <select value={plan} onChange={event=>setPlan(event.target.value)} disabled={busy}><option value="solo">Solo</option><option value="team">Team</option></select></label><label>Billing interval <select value={interval} onChange={event=>setInterval(event.target.value)} disabled={busy}><option value="month">Monthly</option><option value="year">Yearly</option></select></label><p>Review the price and terms in secure checkout before subscribing.</p><Button type="submit" disabled={busy||!data.stripe}>{busy?'Opening checkout…':'Continue to secure checkout'}</Button></form>}
    </>:null}
  </section>;
}

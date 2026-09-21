import { WatchSkeleton } from "@/components/WatchDataState";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {ArrowUpRight,Check,CreditCard,UserRound,UsersRound} from 'lucide-react';
import './workspace-settings.css';
import './organization-billing.css';
const PLANS=[{id:'solo',name:'Solo',monthly:29,yearly:290,description:'For an individual release workflow.',icon:UserRound},{id:'team',name:'Team',monthly:99,yearly:990,description:'For collaborative release review and response.',icon:UsersRound}] as const;
function billingDate(value:string|null){if(!value)return null;const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):null;}
type Billing={stripe:boolean;billing:{plan:string|null;trialEndsAt:string|null;status:string|null;periodEnd:string|null;hasCustomer:boolean;subscribed:boolean}};

type BillingProps={id:string;workspaceId?:string};
export function OrganizationBilling({id,workspaceId}:BillingProps){
  return <OrganizationBillingScope key={`${id}:${workspaceId??''}`} id={id} workspaceId={workspaceId}/>;
}
function OrganizationBillingScope({id,workspaceId}:BillingProps){
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
      const response=await fetch(`/api/billing/${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:id,plan,interval,...(workspaceId?{workspaceId}:{})}),signal:controller.signal});
      const body=await response.json();if(controller.signal.aborted)return;if(!response.ok)throw new Error(body.error??'Billing could not be opened.');
      const destination=new URL(body.url);
      if(destination.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(destination.hostname)||destination.username||destination.password)throw new Error('The billing destination was not recognised. Please retry.');
      window.location.assign(destination.href);
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Billing could not be opened.');}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const trialActive=Boolean(data?.billing.trialEndsAt&&new Date(data.billing.trialEndsAt)>new Date());
  const planName=PLANS.find(item=>item.id===data?.billing.plan)?.name;
  const subscribed=Boolean(data?.billing.subscribed&&planName);
  const returnQuery=new URLSearchParams(window.location.search);
  const billingReturn=returnQuery.get('billingOrganization')===id?returnQuery.get('billing'):null;
  const currentTitle=subscribed?planName:trialActive?'Five-day trial':'Coverage is inactive';
  const currentStatus=subscribed?'Subscribed':trialActive?'Trial active':'Subscription required';
  const periodEnd=billingDate(data?.billing.periodEnd??null),trialEnd=billingDate(data?.billing.trialEndsAt??null);
  return <section className="workspace-billing organisation-billing" aria-label="Organisation billing">
    {error?<div className="organisation-billing-error" role="alert"><p>{error}</p><Button variant="outline" onClick={()=>{setError('');setRetry(v=>v+1);}}>Retry billing</Button></div>:null}
    {!data&&!error?<WatchSkeleton variant="list" className="mt-4" />:null}
    {data?<>
      {['ok','canceled','returned'].includes(billingReturn??'')?<div className="organisation-billing-provider-note" role="status"><p>{billingReturn==='canceled'?'Checkout closed. Your current coverage is shown below.':billingReturn==='ok'&&!subscribed?'Checkout returned. Subscription confirmation is pending; refresh to check the latest coverage.':'Billing refreshed. Your current coverage is shown below.'}</p><Button variant="ghost" disabled={busy} onClick={()=>{setError('');setRetry(value=>value+1);}}>Refresh billing status</Button></div>:null}
      <header className="organisation-billing-current">
        <div className="organisation-billing-identity"><span className="organisation-billing-icon"><CreditCard size={20} aria-hidden/></span><div><span className="organisation-billing-kicker">Current coverage</span><h3>{currentTitle}</h3><p>{subscribed?(periodEnd?`Current period ends ${periodEnd}`:'Your organisation has an active subscription.'):trialActive?`Trial ends ${trialEnd}`:trialEnd?`Trial ended ${trialEnd}. Choose a plan to resume scanning.`:'Choose a plan to enable scanning and monitoring.'}</p></div></div>
        <div className="organisation-billing-current-actions"><span className={`organisation-billing-state ${subscribed||trialActive?'is-active':''}`}>{currentStatus}</span>{data.billing.hasCustomer?<Button variant="outline" disabled={busy||!data.stripe} onClick={()=>void open('portal')}>{busy?'Opening billing…':'Manage subscription'}<ArrowUpRight size={14} aria-hidden/></Button>:null}</div>
      </header>
      {!data.stripe?<p className="organisation-billing-provider-note" role="status">Billing is not configured on this host. No payment can be taken here.</p>:null}
      <form className="organisation-billing-plans" onSubmit={event=>{event.preventDefault();if(!data.billing.hasCustomer)void open('checkout');}}>
        <div className="organisation-billing-plan-heading"><div><h3>{data.billing.hasCustomer?'Available plans':'Choose your plan'}</h3><p>One subscription covers this organisation’s workspaces.</p></div><div className="organisation-billing-frequency" role="radiogroup" aria-label="Billing interval" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const radios=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));const index=radios.indexOf(event.target as HTMLButtonElement);if(index<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?radios.length-1:(index+(event.key==='ArrowRight'?1:-1)+radios.length)%radios.length;radios[next].focus();radios[next].click();}}>{[{id:'month',label:'Monthly'},{id:'year',label:'Yearly'}].map(item=><button type="button" key={item.id} role="radio" tabIndex={interval===item.id?0:-1} aria-checked={interval===item.id} onClick={()=>setInterval(item.id)} disabled={busy}>{item.label}</button>)}</div></div>
        <div className="organisation-billing-plan-grid" role={data.billing.hasCustomer?undefined:'radiogroup'} aria-label="Choose a plan">{PLANS.map(item=>{const Icon=item.icon,selected=data.billing.hasCustomer?data.billing.plan===item.id:plan===item.id;return <label key={item.id} className={`organisation-billing-plan ${selected?'is-selected':''} ${data.billing.hasCustomer?'is-readonly':''}`}>
          {!data.billing.hasCustomer?<input type="radio" name={`organisation-plan-${id}`} value={item.id} checked={plan===item.id} onChange={()=>setPlan(item.id)} disabled={busy} aria-label={item.name}/>:null}
          <span className="organisation-billing-plan-top"><span><Icon size={18} aria-hidden/>{item.name}</span>{selected?<span className="organisation-billing-plan-selection">{data.billing.hasCustomer?'Current plan':<Check size={15} aria-hidden/>}</span>:null}</span>
          <strong className="organisation-billing-price">${interval==='year'?item.yearly:item.monthly}<small>USD / {interval==='year'?'year':'month'}</small></strong><span className="organisation-billing-plan-description">{item.description}</span><span className="organisation-billing-plan-frequency">{interval==='year'?`$${item.yearly} billed annually · save two months`:`$${item.monthly} billed monthly`}</span>
        </label>})}</div>
        <footer className="organisation-billing-checkout"><div><p>Both plans share the five-day trial.</p><span>{data.billing.hasCustomer?'Change plans, payment details or cancellation in secure billing.':'Review the final price and terms in secure checkout before subscribing.'}</span></div>{!data.billing.hasCustomer?<Button type="submit" disabled={busy||!data.stripe}>{busy?'Opening checkout…':'Continue to secure checkout'}<ArrowUpRight size={15} aria-hidden/></Button>:null}</footer>
      </form>
      <p className="organisation-billing-footnote">Disconnecting GitHub does not cancel the subscription or restart the trial.</p>
    </>:null}
  </section>;
}

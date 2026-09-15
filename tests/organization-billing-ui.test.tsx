// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {act,cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import {OrganizationBilling} from '../src/components/watch/OrganizationBilling';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const data={stripe:true,billing:{plan:'trial',trialEndsAt:null,status:null,periodEnd:null,hasCustomer:false,subscribed:false}};
it('does not offer a working payment action on an unconfigured host',async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({...data,stripe:false})));vi.stubGlobal('fetch',fetcher);
  render(<OrganizationBilling id="org"/>);
  expect(await screen.findByText('Billing is not configured on this host. No payment can be taken here.')).toBeTruthy();
  expect((screen.getByRole('button',{name:'Continue to secure checkout'}) as HTMLButtonElement).disabled).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('uses organisation scope and displays recoverable checkout errors',async()=>{
  const fetcher=vi.fn(async(_url:string,input?:RequestInit)=>new Response(JSON.stringify(input?.method?{error:'Please retry checkout.'}:data),{status:input?.method?502:200}));vi.stubGlobal('fetch',fetcher);
  render(<OrganizationBilling id="org"/>);
  await userEvent.click(await screen.findByRole('combobox',{name:'Plan'}));
  await userEvent.click(screen.getByRole('option',{name:'Team'}));
  await userEvent.click(screen.getByRole('combobox',{name:'Billing interval'}));
  await userEvent.click(screen.getByRole('option',{name:'Yearly'}));
  fireEvent.click(screen.getByRole('button',{name:'Continue to secure checkout'}));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Please retry checkout.'));
  await waitFor(()=>expect(fetcher).toHaveBeenCalledWith('/api/billing/checkout',expect.objectContaining({method:'POST',body:JSON.stringify({organizationId:'org',plan:'team',interval:'year'})})));
});
it('rejects an unexpected redirect destination',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(_url:string,input?:RequestInit)=>new Response(JSON.stringify(input?.method?{url:'https://attacker.example/'}:data))));
  render(<OrganizationBilling id="org"/>);fireEvent.click(await screen.findByRole('button',{name:'Continue to secure checkout'}));
  expect(await screen.findByText('The billing destination was not recognised. Please retry.')).toBeTruthy();
});

it('clears old billing data and selections immediately when organisation identity changes',async()=>{
 let resolveBilling!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('organizationId=other')?new Promise<Response>(resolve=>{resolveBilling=resolve;}):Response.json(data)));
 const view=render(<OrganizationBilling id="org"/>);
 await userEvent.click(await screen.findByRole('combobox',{name:'Plan'}));
 await userEvent.click(screen.getByRole('option',{name:'Team'}));
 view.rerender(<OrganizationBilling id="other"/>);
 expect(screen.queryByRole('combobox',{name:'Plan'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Continue to secure checkout'})).toBeNull();
 await act(async()=>resolveBilling(Response.json({...data,stripe:false})));
 expect((await screen.findByRole('combobox',{name:'Plan'})).textContent).toContain('Solo');
 expect(screen.getByRole('button',{name:'Continue to secure checkout'})).toHaveProperty('disabled',true);
});

it('aborts a pending checkout when leaving its organisation and ignores a late result',async()=>{
 let resolveCheckout!:(value:Response)=>void;
 let checkoutSignal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method){checkoutSignal=init.signal as AbortSignal;return new Promise<Response>(resolve=>{resolveCheckout=resolve;});}
  return Response.json(data);
 }));
 const view=render(<OrganizationBilling id="org"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Continue to secure checkout'}));
 expect(checkoutSignal?.aborted).toBe(false);
 view.rerender(<OrganizationBilling id="other"/>);
 expect(checkoutSignal?.aborted).toBe(true);
 await screen.findByRole('button',{name:'Continue to secure checkout'});
 await act(async()=>resolveCheckout(Response.json({url:'https://attacker.example/'})));
 expect(screen.queryByRole('alert')).toBeNull();
});

it('withholds stale payment controls while retrying billing capability',async()=>{
 let reads=0;
 let resolveBilling!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init?:RequestInit)=>{
  if(init?.method)return Response.json({error:'Retry billing first.'},{status:502});
  reads+=1;return reads===1?Response.json(data):new Promise<Response>(resolve=>{resolveBilling=resolve;});
 }));
 render(<OrganizationBilling id="org"/>);
 await userEvent.click(await screen.findByRole('button',{name:'Continue to secure checkout'}));
 await userEvent.click(await screen.findByRole('button',{name:'Retry billing'}));
 expect(screen.queryByRole('button',{name:'Continue to secure checkout'})).toBeNull();
 await act(async()=>resolveBilling(Response.json({...data,stripe:false})));
 expect(await screen.findByRole('button',{name:'Continue to secure checkout'})).toHaveProperty('disabled',true);
});

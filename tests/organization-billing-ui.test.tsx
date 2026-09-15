// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import {radixUiTestSupport} from './helpers/radix-ui';
radixUiTestSupport();
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
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

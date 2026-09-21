// @vitest-environment jsdom
import {useState} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Button} from '../src/components/ui/button';
import {HealthScreen} from '../src/components/watch/screens/HealthScreen';
import {RegistriesScreen} from '../src/components/watch/screens/RegistriesScreen';
const context=vi.hoisted(()=>({current:{} as Record<string,unknown>}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>context.current}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function Harness({view,admin=true,ended=false}:{view:'health'|'registries';admin?:boolean;ended?:boolean}){
 const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState<number|null>(null);
 context.current={Button,route:{view},previewing:false,ended,locked:ended,installAdmin:admin,user:{id:'user'},
 activeInstallId:1,selectedInstall:{id:1,account_login:'owner'},installations:[{id:1,account_login:'owner'}],
 jobs:[],jobSummary:{queued:0,running:0,done:0,failed:0},setMe:vi.fn(),testError:error,setTestError:setError,testingInstallId:busy,setTestingInstallId:setBusy,
 registries:[],registryError:error,setRegistryError:setError,registryOriginInput:'https://registry.example.com',registryToken:'token',setRegistryOriginInput:vi.fn(),setRegistryToken:vi.fn(),setSavingRegistry:vi.fn(),refreshSignedIn:vi.fn(),confirmForm:()=>null};
 return <>{view==='health'?<HealthScreen/>:<RegistriesScreen/>}<button>Other action</button></>;
}
it.each(['health','registries'] as const)('%s announces mutation rejection and focuses it only when the user stays',async view=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Request rejected'}),{status:503})));
 render(<Harness view={view}/>);
 if(view==='registries')fireEvent.click(screen.getByRole('button',{name:'Add registry'}));
 const trigger=screen.getAllByRole('button',{name:view==='health'?'Test install':'Save token'})[0];
 trigger.focus();fireEvent.click(trigger);
 const alert=await screen.findByRole('alert');
 await waitFor(()=>expect(document.activeElement).toBe(alert));
 expect(alert.textContent).toBe('Request rejected');
});
it.each(['health','registries'] as const)('%s leaves moved keyboard focus alone on late rejection',async view=>{
 let finish!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
 render(<Harness view={view}/>);
 if(view==='registries')fireEvent.click(screen.getByRole('button',{name:'Add registry'}));
 const trigger=screen.getAllByRole('button',{name:view==='health'?'Test install':'Save token'})[0];
 trigger.focus();fireEvent.click(trigger);
 const other=screen.getByRole('button',{name:'Other action'});other.focus();
 finish(new Response(JSON.stringify({error:'Request rejected'}),{status:503}));
 await screen.findByRole('alert');expect(document.activeElement).toBe(other);
});
it('labels the registry focus shortcut truthfully and explains read-only access',()=>{
 const {unmount}=render(<Harness view="registries"/>);
 fireEvent.click(screen.getByRole('button',{name:'Add registry'}));
 expect(document.activeElement).toBe(screen.getByLabelText('Origin'));
 unmount();render(<Harness view="registries" admin={false}/>);
 expect(screen.getByText(/Read-only. An installation administrator/)).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Save token'})).toBeNull();
});

it.each(['health','registries'] as const)('%s aborts pending requests when the screen unmounts',async view=>{
 let finish!:(value:Response)=>void;let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}));
 const mounted=render(<Harness view={view}/>);
 if(view==='registries')fireEvent.click(screen.getByRole('button',{name:'Add registry'}));
 fireEvent.click(screen.getByRole('button',{name:view==='health'?'Test install':'Save token'}));
 const refresh=context.current.refreshSignedIn as ReturnType<typeof vi.fn>,setMe=context.current.setMe as ReturnType<typeof vi.fn>;
 const clearToken=context.current.setRegistryToken as ReturnType<typeof vi.fn>;
 mounted.unmount();expect(signal?.aborted).toBe(true);if(view==='registries')expect(clearToken).toHaveBeenCalledWith('');
 await act(async()=>finish(Response.json({test:{ok:true,testedAt:'2026-09-20T00:00:00Z'}})));
 expect(refresh).not.toHaveBeenCalled();expect(setMe).not.toHaveBeenCalled();
});

it('keeps expired registry details readable while disabling credential creation',()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);render(<Harness view="registries" ended/>);
 expect(screen.getByText(/Saved registry details remain readable/)).toBeTruthy();
 const add=screen.getByRole('button',{name:'Add registry'});expect(add).toHaveProperty('disabled',true);
 fireEvent.click(add);expect(fetcher).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Save token'})).toBeNull();
});

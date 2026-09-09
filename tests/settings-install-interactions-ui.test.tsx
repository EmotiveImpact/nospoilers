// @vitest-environment jsdom
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Button} from '../src/components/ui/button';
import {HealthScreen} from '../src/components/watch/screens/HealthScreen';
import {RegistriesScreen} from '../src/components/watch/screens/RegistriesScreen';
const context=vi.hoisted(()=>({current:{} as Record<string,unknown>}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>context.current}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function Harness({view,admin=true}:{view:'health'|'registries';admin?:boolean}){
 const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState<number|null>(null);
 context.current={Button,route:{view},previewing:false,ended:false,locked:false,installAdmin:admin,user:{id:'user'},
 activeInstallId:1,selectedInstall:{id:1,account_login:'owner'},installations:[{id:1,account_login:'owner'}],
 jobs:[],jobSummary:{queued:0,running:0,done:0,failed:0},setMe:vi.fn(),testError:error,setTestError:setError,testingInstallId:busy,setTestingInstallId:setBusy,
 registries:[],registryError:error,setRegistryError:setError,registryOriginInput:'https://registry.example.com',registryToken:'token',setRegistryOriginInput:vi.fn(),setRegistryToken:vi.fn(),setSavingRegistry:vi.fn(),refreshSignedIn:vi.fn(),confirmForm:()=>null};
 return <>{view==='health'?<HealthScreen/>:<RegistriesScreen/>}<button>Other action</button></>;
}
it.each(['health','registries'] as const)('%s announces mutation rejection and focuses it only when the user stays',async view=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({error:'Request rejected'}),{status:503})));
 render(<Harness view={view}/>);
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

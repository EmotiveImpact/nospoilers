// @vitest-environment jsdom
import {useState} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {TokensScreen} from '../src/components/watch/screens/TokensScreen';
import {Button} from '../src/components/ui/button';
const context=vi.hoisted(()=>({current:{} as Record<string,unknown>}));
vi.mock('../src/components/watch/useWatchScreenContext',()=>({useWatchScreenContext:()=>context.current}));
const refresh=vi.fn();afterEach(()=>{cleanup();refresh.mockClear();vi.unstubAllGlobals();});
function Harness(){
 const [minting,setMinting]=useState(false),[secret,setSecret]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 context.current={Button,activeInstallId:1,route:{view:'tokens'},installAdmin:true,user:{id:1},installations:[{id:1}],locked:false,previewing:false,ended:false,mintingScanToken:minting,setMintingScanToken:setMinting,revealedScanToken:secret,setRevealedScanToken:setSecret,scanTokenError:error,setScanTokenError:setError,scanTokenName:'CI',setScanTokenName:vi.fn(),scanTokens:[],refreshSignedIn:refresh};
 return <TokensScreen/>;
}
it('aborts a token creation on leaving and ignores its late secret',async()=>{
 let finish!:(value:Response)=>void;let signal:AbortSignal|undefined;
 vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{finish=resolve;});}));
 const view=render(<Harness/>);fireEvent.click(screen.getAllByRole('button',{name:'Mint token'}).at(-1)!);
 view.unmount();expect(signal?.aborted).toBe(true);
 await act(async()=>finish(Response.json({token:'nsp_late_secret'})));
 expect(refresh).not.toHaveBeenCalled();
});
it('reports an incomplete mint response without claiming the secret was received',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({})));
 render(<Harness/>);fireEvent.click(screen.getAllByRole('button',{name:'Mint token'}).at(-1)!);
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','The token secret was not received. Check the token list before trying again.');
 expect(refresh).not.toHaveBeenCalled();
});
it('lets the owner dismiss a once-shown credential without another request',async()=>{
 const fetcher=vi.fn(async()=>Response.json({token:'nsp_secret'}));vi.stubGlobal('fetch',fetcher);
 render(<Harness/>);fireEvent.click(screen.getAllByRole('button',{name:'Mint token'}).at(-1)!);
 await screen.findByText('nsp_secret');fireEvent.click(screen.getByRole('button',{name:'I’ve saved it'}));
 expect(screen.queryByText('nsp_secret')).toBeNull();expect(fetcher).toHaveBeenCalledTimes(1);
});

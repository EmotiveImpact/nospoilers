import type {Readable,Writable} from 'node:stream';
import {AGENT_TOOLS,AGENT_DATA_NOTICE} from './agent-tools.ts';
import {readBoundedBody} from './server/bounded-body.ts';
type Rpc={jsonrpc?:unknown;id?:unknown;method?:unknown;params?:Record<string,unknown>};
export function createMcpSession(send:(message:object)=>void,call:(name:string,args:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>){
  let initialized=false,ready=false,requests=0;const pending=new Map<string|number,AbortController>();
  const error=(id:unknown,code:number,message:string)=>send({jsonrpc:'2.0',id,error:{code,message}});
  return {
    close(){for(const c of pending.values())c.abort();pending.clear();},
    async receive(raw:unknown){
      const r=raw as Rpc;
      if(!r||typeof r!=='object'||Array.isArray(r)||r.jsonrpc!=='2.0'||typeof r.method!=='string'){error(null,-32600,'Invalid request');return;}
      if(r.id===undefined){
        if(r.method==='notifications/initialized'&&initialized)ready=true;
        if(r.method==='notifications/cancelled'){const id=r.params?.requestId;if(typeof id==='string'||typeof id==='number')pending.get(id)?.abort();}
        return;
      }
      const id=r.id;if(typeof id!=='string'&&!(typeof id==='number'&&Number.isSafeInteger(id))){error(null,-32600,'Invalid request identifier');return;}
      if(pending.has(id)){error(id,-32600,'Request identifier already active');return;}
      if(++requests>512){error(id,-32000,'Session request budget exhausted; reconnect explicitly.');return;}
      const result=(value:unknown)=>send({jsonrpc:'2.0',id,result:value});
      if(r.method==='initialize'){
        if(initialized||typeof r.params?.protocolVersion!=='string'||!r.params?.clientInfo){error(id,-32602,'Invalid initialization');return;}
        initialized=true;result({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'nospoilers-evidence',version:'1.0.0'},instructions:AGENT_DATA_NOTICE});return;
      }
      if(r.method==='ping'){result({});return;}
      if(!ready){error(id,-32002,'Initialize the session first');return;}
      if(r.method==='tools/list'){result({tools:AGENT_TOOLS});return;}
      if(r.method!=='tools/call'){error(id,-32601,'Method not found');return;}
      if(pending.size>=4){error(id,-32000,'At most four simultaneous tool calls');return;}
      const name=r.params?.name,args=r.params?.arguments??{};
      if(typeof name!=='string'||!AGENT_TOOLS.some(t=>t.name===name)||!args||typeof args!=='object'||Array.isArray(args)){error(id,-32602,'Invalid tool arguments');return;}
      const controller=new AbortController();pending.set(id,controller);
      try{
        const data=await call(name,args as Record<string,unknown>,controller.signal);
        if(!controller.signal.aborted)result({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});
      }catch{
        // Do not echo upstream errors, URLs, request bodies or credentials into model context.
        if(!controller.signal.aborted)result({isError:true,content:[{type:'text',text:'Tool failed or its scope/budget expired. Review access in NoSpoilers; do not infer success.'}]});
      }finally{pending.delete(id);}
    },
  };
}
export async function runMcp(input:{api:string;token:string},stdin:Readable=process.stdin,stdout:Writable=process.stdout,transport:typeof fetch=fetch){
  const origin=new URL(input.api);
  if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))throw new Error('MCP requires an HTTPS application origin or loopback development.');
  if(!/^nsa_[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(input.token))throw new Error('Set NOSPOILERS_AGENT_TOKEN to an explicit agent credential.');
  const session=createMcpSession(message=>{stdout.write(`${JSON.stringify(message)}\n`);},async(name,args,cancel)=>{
    const signal=AbortSignal.any([cancel,AbortSignal.timeout(20000)]);
    const response=await transport(new URL('/api/release-intelligence/agent-tools',origin),{method:'POST',signal,redirect:'error',headers:{authorization:`Bearer ${input.token}`,'content-type':'application/json'},body:JSON.stringify({name,arguments:args})});
    const bytes=await readBoundedBody(response.body,512000,response.headers.get('content-length'),20000,signal);
    if(!response.ok)throw new Error('Tool request failed.');return JSON.parse(bytes.toString('utf8'));
  });
  let buffer=Buffer.alloc(0);const inflight=new Set<Promise<void>>();
  try{
    for await(const chunk of stdin){
      buffer=Buffer.concat([buffer,Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)]);
      let newline:number;
      while((newline=buffer.indexOf(10))>=0){
        if(newline>16384)throw new Error('MCP message exceeds 16 KiB.');
        const line=buffer.subarray(0,newline);buffer=buffer.subarray(newline+1);
        let message:unknown;try{message=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(line));}catch{stdout.write(`${JSON.stringify({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})}\n`);continue;}
        const work=session.receive(message);inflight.add(work);void work.then(()=>inflight.delete(work),()=>inflight.delete(work));
      }
      if(buffer.length>16384)throw new Error('MCP message exceeds 16 KiB.');
    }
  }finally{session.close();await Promise.allSettled(inflight);}
}

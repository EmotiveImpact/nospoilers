/** Read incrementally: a declared size is only an early check, never the enforcement boundary. */
export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, maxBytes:number, declared?:string|null,timeoutMs=30_000):Promise<Buffer> {
  const tooLarge=()=>Object.assign(new Error(`Body exceeds the ${Math.floor(maxBytes/1024/1024)} MB limit.`),{status:413});
  if(declared && Number(declared)>maxBytes) { void body?.cancel().catch(()=>undefined); throw tooLarge(); }
  if(!body)return Buffer.alloc(0);
  const reader=body.getReader();const chunks:Uint8Array[]=[];let size=0;
  let timer:ReturnType<typeof setTimeout>;
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{
    reject(Object.assign(new Error('Upload read deadline exceeded.'),{status:408}));
    void reader.cancel().catch(()=>undefined);
  },timeoutMs);});
  try {
    while(true){const result=await Promise.race([reader.read(),deadline]);if(result.done)break;size+=result.value.byteLength;
      if(size>maxBytes){void reader.cancel().catch(()=>undefined);throw tooLarge();}chunks.push(result.value);}
    return Buffer.concat(chunks,size);
  } finally {clearTimeout(timer!);reader.releaseLock();}
}

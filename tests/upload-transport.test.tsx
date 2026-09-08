// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import { uploadArtifact } from '../src/watch/upload-transport.ts';
class FakeRequest {
  static latest:FakeRequest;
  upload:{onprogress?: (event:{lengthComputable:boolean;loaded:number;total:number})=>void}={};
  onload?:()=>void;onerror?:()=>void;ontimeout?:()=>void;onabort?:()=>void;
  status=202;responseText='{"queued":true}';timeout=0;withCredentials=false;
  headers:Record<string,string>={};url='';sent=false;
  constructor(){FakeRequest.latest=this;}
  open(_method:string,url:string){this.url=url;}
  setRequestHeader(key:string,value:string){this.headers[key]=value;}
  send(){this.sent=true;}
  abort(){this.onabort?.();}
}
afterEach(()=>vi.unstubAllGlobals());
describe('artifact upload transport',()=>{
  it('reports actual transferred bytes and retains destination scope',async()=>{
    vi.stubGlobal('XMLHttpRequest',FakeRequest);const progress=vi.fn();
    const pending=uploadArtifact(new File(['bytes'],'pack.zip'),'7',progress,new AbortController().signal);
    const request=FakeRequest.latest;
    request.upload.onprogress?.({lengthComputable:true,loaded:2,total:4});
    expect(progress).toHaveBeenCalledWith(50);
    expect(request.url).toBe('/api/scan?installationId=7');
    expect(request.headers['Idempotency-Key']).toBeTruthy();expect(request.timeout).toBe(120000);
    request.onload?.();expect((await pending).status).toBe(202);
  });
  it('stops the transfer without claiming to cancel a queued scan',async()=>{
    vi.stubGlobal('XMLHttpRequest',FakeRequest);const controller=new AbortController();
    const pending=uploadArtifact(new File(['bytes'],'pack.zip'),null,()=>{},controller.signal);
    controller.abort();await expect(pending).rejects.toThrow('may still appear in Releases');
  });
});

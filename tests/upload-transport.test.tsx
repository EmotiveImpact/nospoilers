// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import { uploadArtifact, scanSubmissionUrl } from '../src/watch/upload-transport.ts';
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
  it('shares explicit destination routing between uploads and local fixtures',async()=>{
    expect(scanSubmissionUrl(null,'workspace-one')).toBe('/api/scan?workspaceId=workspace-one');
    expect(scanSubmissionUrl('7','workspace-one')).toBe('/api/scan?installationId=7&workspaceId=workspace-one');
    expect(scanSubmissionUrl()).toBe('/api/scan');
    expect(scanSubmissionUrl(null,'workspace-one','claim')).toBe('/api/scan/pending?workspaceId=workspace-one');
    vi.stubGlobal('XMLHttpRequest',FakeRequest);
    const pending=uploadArtifact(new File(['bytes'],'pack.zip'),'7',()=>{},new AbortController().signal,'workspace-one');
    expect(FakeRequest.latest.url).toBe(scanSubmissionUrl('7','workspace-one'));
    FakeRequest.latest.onload?.();await pending;
  });
  it('reports actual transferred bytes and retains destination scope',async()=>{
    vi.stubGlobal('XMLHttpRequest',FakeRequest);const progress=vi.fn();
    const pending=uploadArtifact(new File(['bytes'],'pack.zip'),'7',progress,new AbortController().signal);
    const request=FakeRequest.latest;
    request.upload.onprogress?.({lengthComputable:true,loaded:2,total:4});
    expect(progress).toHaveBeenCalledWith(50);
    expect(request.url).toBe('/api/scan?installationId=7');
    expect(request.headers['Idempotency-Key']).toBeTruthy();expect(request.timeout).toBe(0);
    request.onload?.();expect((await pending).status).toBe(202);
  });
  it('times out on inactivity, not on total upload duration',async()=>{
    vi.useFakeTimers();
    try{
      vi.stubGlobal('XMLHttpRequest',FakeRequest);
      const pending=uploadArtifact(new File(['bytes'],'pack.zip'),null,()=>{},new AbortController().signal);
      const request=FakeRequest.latest;
      for(let step=1;step<=5;step++){vi.advanceTimersByTime(100_000);request.upload.onprogress?.({lengthComputable:true,loaded:step,total:10});}
      let settled=false;void pending.then(()=>{settled=true;},()=>{settled=true;});
      await Promise.resolve();expect(settled).toBe(false);
      vi.advanceTimersByTime(120_000);
      await expect(pending).rejects.toThrow('Upload timed out');
    }finally{vi.useRealTimers();}
  });
  it('stops the transfer without claiming to cancel a queued scan',async()=>{
    vi.stubGlobal('XMLHttpRequest',FakeRequest);const controller=new AbortController();
    const pending=uploadArtifact(new File(['bytes'],'pack.zip'),null,()=>{},controller.signal);
    controller.abort();await expect(pending).rejects.toThrow('may still appear in Releases');
  });
});

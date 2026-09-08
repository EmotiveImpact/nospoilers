import { beforeEach,describe,expect,it,vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { RequestOptions } from 'node:https';

const transport=vi.hoisted(()=>({request:vi.fn()}));
vi.mock('node:https',()=>({request:transport.request}));
import { pinnedHttps } from '../src/server/pinned-https.ts';

beforeEach(()=>transport.request.mockReset());
describe('connection-pinned HTTPS',()=>{
  it('uses only the vetted address, without disabling hostname/TLS verification',async()=>{
    let options:RequestOptions|undefined;
    transport.request.mockImplementation((_url,opts,receive)=>{
      options=opts;
      const req=new EventEmitter() as EventEmitter&{end:()=>void};
      req.end=()=>{
        const res=Object.assign(new EventEmitter(),{statusCode:200,headers:{'content-type':'text/plain'}});
        receive(res);res.emit('data',Buffer.from('hello'));res.emit('end');
      };
      return req;
    });
    const lookup=vi.fn().mockResolvedValueOnce([{address:'93.184.216.34',family:4}]).mockResolvedValue([{address:'127.0.0.1',family:4}]);
    const response=await pinnedHttps('https://example.com/file',{},10,lookup);
    expect(await response.text()).toBe('hello');expect(lookup).toHaveBeenCalledTimes(1);
    expect(options?.agent).toBe(false);expect(options?.rejectUnauthorized).toBe(true);
    const callback=vi.fn();options?.lookup?.('example.com',{},callback);
    expect(callback).toHaveBeenCalledWith(null,'93.184.216.34',4);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('never starts a connection for a mixed public/private DNS answer',async()=>{
    await expect(pinnedHttps('https://example.com',{},10,async()=>[{address:'93.184.216.34',family:4},{address:'::ffff:7f00:1',family:6}])).rejects.toThrow('public address');
    expect(transport.request).not.toHaveBeenCalled();
  });
  it('rejects redirect responses without following the Location',async()=>{
    const destroy=vi.fn();
    transport.request.mockImplementation((_url,_opts,receive)=>{
      const req=Object.assign(new EventEmitter(),{end:()=>receive({statusCode:302,headers:{location:'https://127.0.0.1/'},destroy})});return req;
    });
    await expect(pinnedHttps('https://example.com',{},10,async()=>[{address:'93.184.216.34',family:4}])).rejects.toThrow('Redirects');
    expect(destroy).toHaveBeenCalled();expect(transport.request).toHaveBeenCalledTimes(1);
  });
});

import {describe,expect,it} from 'vitest';
import {loadWatchJson,WatchApiError} from '../src/watch/api.ts';

const html=(status:number)=>async()=>new Response('<html><body>Bad gateway</body></html>',{status,headers:{'content-type':'text/html'}});
describe('loadWatchJson',()=>{
  it('turns an HTML error page into a status message, not a parser error',async()=>{
    const error=await loadWatchJson('/api/x',{},html(502)).catch((caught:unknown)=>caught);
    expect(error).toBeInstanceOf(WatchApiError);
    expect((error as WatchApiError).message).toBe('Request failed (502)');
    expect((error as WatchApiError).status).toBe(502);
  });
  it('keeps the server error text when the body is JSON',async()=>{
    await expect(loadWatchJson('/api/x',{},async()=>Response.json({error:'Not allowed'},{status:403}))).rejects.toThrow('Not allowed');
  });
  it('reports an unreadable successful response without the parser error',async()=>{
    await expect(loadWatchJson('/api/x',{},html(200))).rejects.toThrow('Unreadable response (200)');
  });
});

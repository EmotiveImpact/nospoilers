import { createApp as createHttpApp, type AppDeps } from '../../src/server/app.ts';
import { processUploadedScan } from '../../src/server/upload-worker.ts';
import { scan } from '../../src/scanner/index.ts';

/** Legacy release feature tests act as a polling CI client, not a synchronous HTTP parser. */
export function createApp(deps:AppDeps) {
  const app=createHttpApp(deps),request=app.request.bind(app);
  app.request=async (...args:Parameters<typeof app.request>)=>{
    const response=await request(...args);
    if(String(args[0])!=='/api/v1/scan' || response.status!==202)return response;
    const queued=await response.json() as {uploadId:string};
    await processUploadedScan(queued.uploadId,deps.store,deps.scan??scan,deps.config.receiptSecret);
    return request(`/api/v1/scans/${queued.uploadId}`,{headers:args[1]?.headers});
  };
  return app;
}

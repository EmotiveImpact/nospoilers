/**
 * Worker shutdown must not turn an in-flight parse into scan evidence. An
 * interrupted scan stops its executor, then the job returns to the queue.
 */
export class ScanInterruptedError extends Error {
 constructor(options?:{cause?:unknown}) {
  super('Scan interrupted by worker shutdown.',options);
  this.name='ScanInterruptedError';
 }
}

/** Callers may wrap scanner errors; follow a short cause chain. */
export function isScanInterruption(error:unknown):boolean {
 let current=error;
 for(let depth=0;depth<5&&current;depth++){
  if(current instanceof ScanInterruptedError)return true;
  current=current instanceof Error?current.cause:undefined;
 }
 return false;
}

export type ScanInterrupter={
 readonly interrupted:boolean;
 /** Register an executor's controller. Throws once shutdown has begun. */
 track(controller:AbortController):()=>void;
 /** Refuse new executors and abort active ones. Returns how many were aborted. */
 interrupt():number;
};

export function createScanInterrupter():ScanInterrupter {
 const active=new Set<AbortController>();
 let interrupted=false;
 return {
  get interrupted(){return interrupted;},
  track(controller){
   if(interrupted)throw new ScanInterruptedError();
   active.add(controller);
   return ()=>{active.delete(controller);};
  },
  interrupt(){
   interrupted=true;
   const count=active.size;
   for(const controller of active)controller.abort(new ScanInterruptedError());
   active.clear();
   return count;
  },
 };
}

/** Process-wide: shutdown is process-wide, and executors are created deep inside job handlers. */
export const workerScanInterrupter=createScanInterrupter();

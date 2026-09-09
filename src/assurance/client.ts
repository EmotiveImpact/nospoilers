export { readAssuranceView } from './view.ts';

/** Browser-only download; shared evidence validation stays DOM-independent. */
export function downloadPassport(passport:Record<string,unknown>,id:number|string):void{
  const url=URL.createObjectURL(new Blob([`${JSON.stringify(passport,null,2)}\n`],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`nospoilers-release-passport-${String(id).replace(/[^a-zA-Z0-9_-]/g,'-')}.json`;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

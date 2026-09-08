import { lstat,readdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** Recovery for worker death: only our generated, day-old staging directories. */
export async function cleanupAbandonedParserFiles(now=Date.now()):Promise<number>{
  const root=tmpdir();let removed=0;
  for(const name of await readdir(root)){
    if(!/^nospoilers-(?:parser|upload|rel|npm|web)-[A-Za-z0-9]{6}$/.test(name))continue;
    const target=path.join(root,name);
    const info=await lstat(target).catch(()=>null);
    if(!info?.isDirectory() || info.isSymbolicLink() || now-info.mtimeMs<86_400_000)continue;
    await rm(target,{recursive:true,force:true});removed++;
  }
  return removed;
}

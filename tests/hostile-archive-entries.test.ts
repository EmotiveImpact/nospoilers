import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe,expect,it} from 'vitest';
import {scan} from '../src/scanner/index.ts';

// Hand-built ustar entries: tar libraries refuse to create device/FIFO entries
// from ordinary files, but a hostile release pack can carry any typeflag.
function tarEntry(name:string,type:string,content='',linkname=''):Buffer {
 const header=Buffer.alloc(512);
 const field=(offset:number,length:number,value:string)=>header.write(value,offset,length,'latin1');
 const octal=(offset:number,length:number,value:number)=>field(offset,length,value.toString(8).padStart(length-1,'0')+'\0');
 field(0,100,name);
 octal(100,8,0o644);octal(108,8,0);octal(116,8,0);
 octal(124,12,Buffer.byteLength(content));octal(136,12,0);
 field(148,8,' '.repeat(8));
 field(156,1,type);
 field(157,100,linkname);
 field(257,6,'ustar\0');field(263,2,'00');
 octal(329,8,type==='3'||type==='4'?1:0);octal(337,8,type==='3'||type==='4'?3:0);
 let sum=0;for(const byte of header)sum+=byte;
 field(148,8,sum.toString(8).padStart(6,'0')+'\0 ');
 const body=Buffer.alloc(Math.ceil(Buffer.byteLength(content)/512)*512);
 body.write(content,'latin1');
 return Buffer.concat([header,body]);
}

describe('hostile archive special entries',()=>{
 it('never materialises device, FIFO or escaping link entries while still scanning ordinary files',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ns-hostile-tar-'));
  try {
   const archive=path.join(dir,'release.tar');
   await writeFile(archive,Buffer.concat([
    tarEntry('pkg/char-device','3'),
    tarEntry('pkg/block-device','4'),
    tarEntry('pkg/pipe','6'),
    tarEntry('pkg/passwd','2','','/etc/passwd'),
    tarEntry('pkg/hard-passwd','1','','/etc/passwd'),
    tarEntry('pkg/index.js','0','console.log(1)\n'),
    Buffer.alloc(1024),
   ]));
   const report=await scan(archive);
   expect(report.status).not.toBe('inconclusive');
   expect(report.manifest.map(row=>row.path)).toEqual([expect.stringMatching(/pkg\/index\.js$/)]);
   const links=report.findings.filter(row=>row.rule==='LNK-001');
   expect(links.map(row=>row.path).sort()).toEqual(['pkg/hard-passwd','pkg/passwd']);
   expect(report.ok).toBe(false);
  } finally {
   await rm(dir,{recursive:true,force:true});
  }
 });
});

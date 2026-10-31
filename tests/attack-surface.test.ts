import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {scan} from '../src/scanner/index.ts';
import {collectAttackSurfaceText,emptyAttackSurface} from '../src/scanner/attack-surface.ts';

it('collects routes, flags, internal hosts and env names from shipped code and rebuilt map sources, never secret values',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ns-surface-'));
  try{
    await writeFile(path.join(dir,'app.js'),`fetch("/api/internal/users");if(isEnabled("new-billing")){}const u="https://staging.api.example.com/v1";`);
    const original=`const key=process.env.STRIPE_SECRET_KEY;const t="ghp_${'a'.repeat(36)}";
      router.get('/admin/refunds');const FEATURE_AI_COPILOT=true;fetch('http://10.0.4.12:8080/health');`;
    await writeFile(path.join(dir,'app.js.map'),JSON.stringify({version:3,sources:['src/server.ts'],sourcesContent:[original],mappings:''}));
    const report=await scan(dir);
    const surface=report.attackSurface!;
    expect(surface.routes).toEqual(expect.arrayContaining(['/api/internal/users','/admin/refunds']));
    expect(surface.flags).toEqual(expect.arrayContaining(['new-billing','FEATURE_AI_COPILOT']));
    expect(surface.hosts).toEqual(expect.arrayContaining(['staging.api.example.com','10.0.4.12']));
    expect(surface.envNames).toContain('STRIPE_SECRET_KEY');
    expect(JSON.stringify(surface)).not.toContain('ghp_');
  }finally{await rm(dir,{recursive:true,force:true});}
});

it('drops token-shaped values and caps each list',()=>{
  const surface=emptyAttackSurface();
  collectAttackSurfaceText(surface,`fetch("/api/keys/sk_live_${'x'.repeat(30)}");`+Array.from({length:80},(_,i)=>`fetch("/api/r${i}");`).join(''));
  expect(surface.routes.some(route=>route.includes('sk_live'))).toBe(false);
  expect(surface.routes).toHaveLength(60);
  expect(surface.truncated).toBe(true);
});

it('ignores ordinary public hosts',()=>{
  const surface=emptyAttackSurface();
  collectAttackSurfaceText(surface,'fetch("https://www.example.com/a");fetch("https://cdn.jsdelivr.net/x")');
  expect(surface.hosts).toEqual([]);
});

import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';

it('does not expose a synthetic customer review launcher or sign-in route',()=>{
  const {scripts}=JSON.parse(readFileSync('package.json','utf8'));
  expect(scripts['dev:review']).toBeUndefined();
  const fixture=readFileSync('scripts/gate-b-browser-fixture.ts','utf8');
  expect(fixture).not.toContain('__dev-review');
  expect(fixture).not.toContain('DEV REVIEW');
  expect(fixture).not.toContain('--dev-review');
  expect(fixture).toContain('pglite://:memory:');
});

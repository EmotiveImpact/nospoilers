/** Dependency-free, scoped presentation regression checks. Not the application test suite. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(resolve(root, 'src/components/marketing/V20Homepage.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'src/components/marketing/cardinal-marketing.css'), 'utf8');
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
check('the additive sheet loads after the existing homepage module', () => {
  assert(source.indexOf('import "./cardinal-marketing.css"') > source.indexOf('import { HomepageD }'));
});
check('no hero, dashboard or logo selector is overridden', () => {
  assert(!/\.(?:hero(?:-[\w-]+)?|desk|app|sidebar|v20-brand(?:-[\w-]+)?)\b/.test(rules));
});
check('no root tokens or authenticated workspace selectors', () => {
  assert(!/:root|\bbody\b|\bhtml\b|\.watch[-\w]*|\.scan-workspace|#root/.test(rules));
});
check('only public marketing selectors', () => {
  for (const match of rules.matchAll(/(?:^|[{}])\s*([^{}]+)\{/g)) {
    const group = match[1].trim();
    if (group.startsWith('@')) continue;
    for (const selector of group.split(/,(?![^()]*\))/)) {
      assert(/^(?:\.v20-home\s|\.homepage-d\s*>)/.test(selector.trim()), selector);
    }
  }
});
check('original sign-in and scan destinations remain', () => {
  assert(source.includes('const scan = () => navigate(me?.user ? "/watch/scan" : "/scan")'));
  assert(source.includes('window.location.assign("/api/auth/github")'));
  assert(source.includes('<HomepageD scanPath={me?.user ? "/watch/scan" : "/scan"} />'));
});
check('native mobile modal, cleanup and Escape remain', () => {
  for (const token of ['dialog.showModal()', 'dialog.close()', 'document.body.style.overflow = overflow', 'event.key === "Escape"', 'onCancel={() => setMobile(false)}']) assert(source.includes(token), token);
});
check('desktop keyboard entry and hidden-menu inert remain', () => {
  assert(source.includes("event.key==='ArrowDown'"));
  assert(source.includes('inert={!open}'));
  assert(source.includes('aria-expanded={open} aria-controls={id}'));
});
check('existing public routes remain available', () => {
  for (const path of ['/product#inspect', '/use-cases#websites', '/use-cases#response', '/product#evidence', '/integrations', '/enterprise', '/docs/getting-started', '/docs/api-tokens-and-ci', '/status', '/disclosure']) assert(source.includes(path), path);
});
check('chevrons and decorative menu icons are labelled correctly', () => {
  assert(source.includes('<ChevronDown className="cardinal-nav-chevron" aria-hidden="true" />'));
  assert(source.includes('<Icon aria-hidden="true" />'));
});
check('original 72px header footprint remains', () => assert(/\.v20-home \.v20-nav\s*\{\s*height: 72px;/.test(rules)));
check('responsive menu breakpoint matches the existing resize handler', () => {
  assert(rules.includes('@media (max-width: 980px)'));
  assert(source.includes('window.innerWidth > 980'));
});
check('mobile keeps a login route and the scan entry', () => {
  assert(rules.includes('.v20-home .v20-mobile-head .v20-mobile-login { display: inline-block; }'));
  assert(!/\.v20-home \.v20-nav-right > \.v20-nav-cta\s*\{[^}]*display:\s*none/.test(rules));
});
check('reduced motion and keyboard focus are explicit', () => {
  assert(rules.includes('@media (prefers-reduced-motion: reduce)'));
  assert(rules.includes(':focus-visible'));
});
// These record the preserved sections at the 23 September deployed checkpoint.
const sha = text => createHash('sha256').update(text).digest('hex');
check('customer homepage/session implementation is unchanged', () => {
  assert.equal(sha(source.split('export function V20Homepage()')[1]), 'bd3e622b0d5a170b476a187f5db947cbbe3829986d18509ccc0e2b677f1a637c');
});
check('footer content and pricing are unchanged', () => {
  assert.equal(sha(source.split('export function MarketingFooter')[1].split('export function V20Homepage()')[0]), 'aac920547deb3ea2b557f1c0e6a15222258e3515019d2b41032cdbe17e733a52');
});
console.log(`\n${passed}/${passed} scoped checks passed.`);

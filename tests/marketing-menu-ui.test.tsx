// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MarketingNav,V20Homepage} from '../src/components/marketing/V20Homepage';
const originalShow=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal');
const originalClose=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'close');
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();for(const [key,descriptor] of [['showModal',originalShow],['close',originalClose]] as const){if(descriptor)Object.defineProperty(HTMLDialogElement.prototype,key,descriptor);else Reflect.deleteProperty(HTMLDialogElement.prototype,key)}});
it('opens a modal mobile menu, locks scrolling and restores it when closed',()=>{
 const show=vi.fn(function(this:HTMLDialogElement){this.open=true});
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:show});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.open=false}});
 render(<MarketingNav me={null} openApp={vi.fn()}/>);
 const previous=document.body.style.overflow;
 fireEvent.click(screen.getByRole('button',{name:'Open menu'}));
 expect(show).toHaveBeenCalledOnce();
 expect(screen.getByRole('dialog',{name:'Site navigation'})).toBeTruthy();
 expect(document.body.style.overflow).toBe('hidden');
 fireEvent.click(screen.getByRole('button',{name:'Close menu'}));
 expect(document.body.style.overflow).toBe(previous);
 expect(document.querySelector('dialog')?.open).toBe(false);
});
it('uses one account action alongside the scan action for each session state',()=>{
 const openApp=vi.fn();
 const {rerender}=render(<MarketingNav me={null} openApp={openApp}/>);
 expect(screen.queryByRole('button',{name:'Open app'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Log in'}));
 expect(openApp).toHaveBeenCalledOnce();
 expect(screen.getByRole('button',{name:'Start a scan'})).toBeTruthy();
 rerender(<MarketingNav me={{user:{login:'tester'},githubApp:true}} openApp={openApp}/>);
 expect(screen.queryByRole('button',{name:'Log in'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Back to workspace'}));
 expect(openApp).toHaveBeenCalledTimes(2);
});
it('opens grouped product links and closes them with Escape',()=>{
 render(<MarketingNav me={null} openApp={vi.fn()}/>);
 const trigger=screen.getByRole('button',{name:'Product',exact:true});
 const panel=document.getElementById('v20-menu-product')!;
 expect(panel.hasAttribute('inert')).toBe(true);
 fireEvent.click(trigger);
 expect(trigger.getAttribute('aria-expanded')).toBe('true');
 expect(panel.hasAttribute('inert')).toBe(false);
 expect(panel.querySelectorAll('.v20-mega-column')).toHaveLength(3);
 expect(panel.querySelector('a')?.getAttribute('href')).toBe('/product#inspect');
 fireEvent.keyDown(trigger,{key:'Escape'});
 expect(trigger.getAttribute('aria-expanded')).toBe('false');
 expect(panel.hasAttribute('inert')).toBe(true);
 expect(document.activeElement).toBe(trigger);
});
it('switches menus and closes when focus leaves the navigation group',()=>{
 render(<MarketingNav me={null} openApp={vi.fn()}/>);
 const product=screen.getByRole('button',{name:'Product',exact:true});
 const resources=screen.getByRole('button',{name:'Resources',exact:true});
 fireEvent.click(product);fireEvent.click(resources);
 expect(product.getAttribute('aria-expanded')).toBe('false');
 const panel=document.getElementById('v20-menu-resources')!;
 expect(panel.querySelectorAll('.v20-mega-column')).toHaveLength(3);
 expect(panel.querySelector('.v20-mega-footer')).toBeNull();
 expect(panel.querySelector('a')?.getAttribute('href')).toBe('/docs');
 fireEvent.blur(resources,{relatedTarget:document.body});
 expect(resources.getAttribute('aria-expanded')).toBe('false');
});
it('ships the approved homepage story as the real homepage',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user:null,githubApp:false})}));
 render(<V20Homepage/>);
 for(const name of [/NoSpoilers checks what your\s*release actually ships/,/Your repository is clean\.\s*Your release might not be\./,'See what hides inside a release','Shipping is not the finish line','Ship it, then prove it','Built on clear boundaries','Questions, answered.'])expect(screen.getByRole('heading',{name})).toBeTruthy();
 const trace=screen.getByRole('tab',{name:/Trace/});
 fireEvent.click(trace);
 expect(trace.getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('tab',{name:/Inspect/}).getAttribute('aria-selected')).toBe('false');
 const release=screen.getByRole('button',{name:'GitHub release'});
 fireEvent.click(release);
 expect(release.getAttribute('aria-pressed')).toBe('true');
 const env=screen.getByRole('button',{name:/linux-x64\/config\/\.env/});
 fireEvent.click(env);
 expect(env.getAttribute('aria-pressed')).toBe('true');
 expect(document.getElementById('fev')?.textContent).toContain('2 working credentials');
 fireEvent.click(screen.getByRole('button',{name:/Recheck after the fix/}));
 await waitFor(()=>expect(document.getElementById('cst')?.textContent).toBe('Example · acme-cli v2.4.2 on GitHub · 0 findings · proof ready'),{timeout:4000});
 expect(screen.getByRole('button',{name:'Reset example'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/Recheck the CDN/}));
 await waitFor(()=>expect(document.getElementById('trchip')?.textContent).toContain('6 of 6 clear'),{timeout:4000});
 expect(document.getElementById('walt')?.textContent).toContain('All six connected sources are clear.');
 fireEvent.click(screen.getByRole('button',{name:/Yearly/}));
 expect([...document.querySelectorAll('.homepage-d .pr [data-m]')].map(el=>el.textContent)).toEqual(['$290','per year','$990','per year']);
 expect(document.getElementById('pterm')?.textContent).toContain('nospoilers verify acme-cli-2.4.2.tgz --receipt receipt.json');
 expect(document.getElementById('pterm')?.textContent).toContain('Artifact SHA-256 matches a passing receipt.');
 expect(document.querySelectorAll('.homepage-d details[name="faq"]')).toHaveLength(6);
 expect(screen.getByText('What is the difference between a scan and coverage?')).toBeTruthy();
});
it('shows only examples of sources NoSpoilers can check, and says they are examples',()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user:null,githubApp:false})}));
 render(<V20Homepage/>);
 const page=document.querySelector('.homepage-d')!;
 const shown=`${page.textContent} ${[...page.querySelectorAll('[aria-label]')].map(el=>el.getAttribute('aria-label')).join(' ')}`;
 for(const mirror of [/jsdelivr/i,/unpkg/i,/esm\.sh/i])expect(shown).not.toMatch(mirror);
 expect(document.getElementById('stage')?.getAttribute('aria-label')).toContain('Example data');
 expect(document.getElementById('cst')?.textContent).toMatch(/^Example · /);
 expect(page.querySelector('#trg .fl')?.textContent).toMatch(/^Example · /);
 expect(page.querySelector('.bnd-note')?.textContent).toBe('Example sequence · no scan is running');
 expect(page.querySelector('img')).toBeNull();
});
it('moves the hero only when the reader scrolls or picks a step, never on a timer',()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user:null,githubApp:false})}));
 vi.useFakeTimers({toFake:['setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame']});
 try{
  render(<V20Homepage/>);
  vi.advanceTimersByTime(15000);
  expect(screen.getByRole('tab',{name:/Inspect/}).getAttribute('aria-selected')).toBe('true');
  fireEvent.click(screen.getByRole('tab',{name:/Watch/}));
  vi.advanceTimersByTime(15000);
  expect(screen.getByRole('tab',{name:/Watch/}).getAttribute('aria-selected')).toBe('true');
  expect(document.querySelector('.homepage-d .lv.on')?.getAttribute('data-s')).toBe('2');
 }finally{vi.useRealTimers()}
});
it('keeps the homepage still for visitors who ask for reduced motion, and tidies up when it leaves',()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user:null,githubApp:false})}));
 vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('reduce'),media:query,addEventListener(){},removeEventListener(){}}));
 const {unmount}=render(<V20Homepage/>);
 expect(document.getElementById('steps')?.classList.contains('still')).toBe(true);
 expect(document.querySelector('.homepage-d animateMotion')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:/Recheck after the fix/}));
 expect(document.getElementById('cst')?.textContent).toBe('Example · acme-cli v2.4.2 · 0 findings · proof ready');
 fireEvent.click(screen.getByRole('button',{name:/Follow a release/}));
 expect(document.getElementById('bndstate')?.textContent).toContain('6 / 6');
 unmount();
});
it('sends Log in to the Watch sign-in screen even when GitHub sign-in is configured',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user:null,githubApp:true})}));
 window.history.replaceState({},'','/');
 render(<V20Homepage/>);
 await screen.findByRole('button',{name:'Log in'});
 await new Promise(resolve=>setTimeout(resolve,0));
 fireEvent.click(screen.getByRole('button',{name:'Log in'}));
 expect(window.location.pathname).toBe('/watch');
});
it('lists only the sources NoSpoilers checks, without third-party logos',()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user:null,githubApp:false})}));
 render(<V20Homepage/>);
 const list=document.querySelector('.ships-list');
 expect(list?.querySelectorAll('li').length).toBe(3);
 for(const name of ['GitHub releases','npm packages','Production websites'])expect(screen.getByText(name)).toBeTruthy();
 expect(list?.textContent).toContain('Public HTTPS assets, after you verify ownership.');
 expect(document.querySelector('img[src*="simple-icons"]')).toBeNull();
 expect(document.body.textContent).not.toContain('—');
});
it('draws the homepage preview with the Watch app\'s own pieces, from the Acme example',()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({user:null,githubApp:false})}));
 vi.stubGlobal('matchMedia',(query:string)=>({matches:query.includes('reduce'),media:query,addEventListener(){},removeEventListener(){}}));
 render(<V20Homepage/>);
 const app=document.querySelector<HTMLElement>('.homepage-d .app')!;
 const slots=[...app.querySelectorAll<HTMLElement>('[data-piece]')];
 expect(slots.map(slot=>slot.dataset.piece)).toEqual(['filemap','fileclear','net','hosts','afterfix','wheel','hosts','feed','receipt']);
 for(const slot of slots)expect(slot.childElementCount,slot.dataset.piece).toBeGreaterThan(0);
 // Inspect: the app's file map, fully read, with the three files that carry a finding lit
 const map=within(app).getByRole('region',{name:'File map'});
 expect(map.querySelectorAll('.np-ft')).toHaveLength(214);
 expect(map.querySelectorAll('.np-ft.is-critical,.np-ft.is-warn')).toHaveLength(3);
 expect(map.querySelectorAll('.np-ft.is-unread')).toHaveLength(0);
 expect(app.querySelectorAll('.row.hf.on')).toHaveLength(3);
 expect(document.getElementById('hchip')?.textContent).toBe('3 findings · 1,283 files');
 expect(app.querySelector('[data-piece="fileclear"]')?.textContent).toBe('Checked, nothing found1,280 files');
 // Trace: every source as it stood when the release was found
 const net=app.querySelector('[data-piece="net"] svg')!.getAttribute('aria-label')!;
 expect(net).toContain('acme-cli v2.4.1 linked to each place it is served');
 for(const source of ['npm registry: Serving this build','GitHub release: Serving this build','cdn.acme.example: Serving this build','app.acme.example: Clean at its last check','Sentry upload: Private, as intended'])expect(net).toContain(source);
 // Watch: hour by hour after the fix, and the verdict in the app's words
 const after=within(app.querySelector<HTMLElement>('[data-piece="afterfix"]')!);
 expect(after.getByRole('img',{name:'Versions: v2.3.2 passed, v2.4.0 passed, v2.4.1 was blocked, v2.4.2 passed and fixed it'})).toBeTruthy();
 expect(after.getByRole('img',{name:'cdn.acme.example, last 12 hours: 12 exposed'})).toBeTruthy();
 expect(after.getByRole('img',{name:'npm registry, last 12 hours: 2 exposed, 10 clear'})).toBeTruthy();
 expect(after.getByText('cdn.acme.example is still serving').parentElement?.textContent).toBe('cdn.acme.example is still serving v2.4.1 after v2.4.2 passed. Alert sent 10:42 UTC.');
 expect(app.querySelector('[data-piece="feed"]')?.textContent).toContain('Alert sent: cdn.acme.example still serves v2.4.1 after the fix');
 // Prove: the eight areas of the fixed release and its receipt check
 expect(app.querySelector('[data-piece="wheel"] svg')?.getAttribute('aria-label')).toMatch(/^8 areas checked\. Package contents: Clear; Source maps: Clear; /);
 expect(app.querySelector('[data-piece="receipt"]')?.textContent).toContain('Receipt passed · SHA-256 matches');
});

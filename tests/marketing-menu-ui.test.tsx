// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {MarketingNav} from '../src/components/marketing/V20Homepage';
const originalShow=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'showModal');
const originalClose=Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype,'close');
afterEach(()=>{cleanup();vi.restoreAllMocks();for(const [key,descriptor] of [['showModal',originalShow],['close',originalClose]] as const){if(descriptor)Object.defineProperty(HTMLDialogElement.prototype,key,descriptor);else Reflect.deleteProperty(HTMLDialogElement.prototype,key)}});
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

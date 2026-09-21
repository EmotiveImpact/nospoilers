import {afterEach,beforeEach,vi} from 'vitest';

// jsdom has no layout or pointer capture. Scope these browser shims to the
// interaction suites; do not emulate Radix's selection or focus behavior.
export function radixUiTestSupport(){
 const methods=['scrollIntoView','hasPointerCapture','setPointerCapture','releasePointerCapture'] as const;
 let originals:Map<string,PropertyDescriptor|undefined>;
 beforeEach(()=>{
  originals=new Map(methods.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis.HTMLElement.prototype,name)]));
  for(const name of methods)if(!globalThis.HTMLElement.prototype[name])Object.defineProperty(globalThis.HTMLElement.prototype,name,{configurable:true,value:name==='hasPointerCapture'?()=>false:()=>{}});
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
 });
 afterEach(()=>{
  for(const [name,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis.HTMLElement.prototype,name,descriptor);else Reflect.deleteProperty(globalThis.HTMLElement.prototype,name);}
 });
}

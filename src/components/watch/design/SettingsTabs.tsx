import * as Tabs from '@radix-ui/react-tabs';
import {useState,useRef,useLayoutEffect,type ReactNode} from 'react';
import './settings-tabs.css';

type SettingsTab={id:string;label:string;content:ReactNode};
export function SettingsTabs({label,tabs,value,defaultValue,onValueChange}:{label:string;tabs:SettingsTab[];value?:string;defaultValue?:string;onValueChange?:(value:string)=>void}){
 const list=useRef<HTMLDivElement>(null);
 const [local,setLocal]=useState(defaultValue??tabs[0]?.id??'');
 const selected=tabs.some(tab=>tab.id===(value??local))?(value??local):tabs[0]?.id??'';
 useLayoutEffect(()=>{
  const node=list.current;if(!node)return;
  const reveal=()=>{const active=node.querySelector<HTMLElement>('[data-state="active"]');if(!active)return;const item=active.getBoundingClientRect(),frame=node.getBoundingClientRect();if(item.right>frame.right)node.scrollLeft+=item.right-frame.right;else if(item.left<frame.left)node.scrollLeft-=frame.left-item.left;};
  reveal();if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',reveal);return()=>window.removeEventListener('resize',reveal);}
  const observer=new ResizeObserver(reveal);observer.observe(node);return()=>observer.disconnect();
 },[selected]);
 return <Tabs.Root className="settings-tabs" value={selected} onValueChange={next=>{setLocal(next);onValueChange?.(next);}} activationMode="manual">
  <Tabs.List ref={list} aria-label={label} className="settings-tabs-list">{tabs.map(tab=><Tabs.Trigger key={tab.id} value={tab.id} className="settings-tab">{tab.label}</Tabs.Trigger>)}</Tabs.List>
  {tabs.map(tab=><Tabs.Content key={tab.id} value={tab.id} forceMount hidden={selected!==tab.id} className="settings-tab-panel">{tab.content}</Tabs.Content>)}
 </Tabs.Root>;
}

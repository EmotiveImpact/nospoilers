import {Combobox,ComboboxInput,ComboboxButton,ComboboxOptions,ComboboxOption} from '@headlessui/react';
import {Check,ChevronDown,Search} from 'lucide-react';
import {useState} from 'react';

type Repository={id:number|string;full_name:string};
export function RepositoryPicker({repos,value,onChange,disabled=false,id}:{repos:Repository[];value:string;onChange:(id:string)=>void;disabled?:boolean;id?:string}){
 const [query,setQuery]=useState('');
 const selected=repos.find(repo=>String(repo.id)===value)??null;
 const matches=repos.filter(repo=>repo.full_name.toLowerCase().includes(query.trim().toLowerCase()));
 return <Combobox immediate value={selected} by="id" onChange={repo=>{if(repo)onChange(String(repo.id));}} disabled={disabled} onClose={()=>setQuery('')}>
  <div className="relative min-w-0">
   <Search className="pointer-events-none absolute left-3 top-3 size-4 text-mute" aria-hidden/>
   <ComboboxInput id={id} aria-label="Repository" displayValue={(repo:Repository|null)=>repo?.full_name??''} onChange={event=>setQuery(event.target.value)} placeholder="Search repositories…" className="h-10 w-full min-w-0 rounded-md border border-white/15 bg-[#090a0c] pl-9 pr-10 text-sm text-snow outline-none focus:border-white/40 disabled:opacity-50"/>
   <ComboboxButton aria-label="Show repositories" className="absolute inset-y-0 right-0 px-3 text-mute"><ChevronDown className="size-4" aria-hidden/></ComboboxButton>
  </div>
  <ComboboxOptions anchor="bottom start" portal className="z-[70] max-h-64 w-[var(--input-width)] max-w-[calc(100vw-24px)] overflow-auto rounded-md border border-white/15 bg-[#090a0c] p-1 text-sm text-snow shadow-xl outline-none [--anchor-gap:6px]">
   {matches.map(repo=><ComboboxOption key={repo.id} value={repo} className="group flex cursor-pointer items-center gap-2 rounded px-3 py-2 data-focus:bg-white/5"><span className="min-w-0 flex-1 break-all">{repo.full_name}</span><Check className="size-4 shrink-0 invisible group-data-selected:visible" aria-hidden/></ComboboxOption>)}
   {!matches.length?<p role="status" className="px-3 py-3 text-mute">No repositories match “{query}”.</p>:null}
  </ComboboxOptions>
 </Combobox>;
}

import { motion, useReducedMotion } from 'motion/react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowRight, Bell, Box, FileCheck2, PanelTop, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { navigate } from "@/nav.ts";
import { ListPagination } from '@/components/watch/ListPagination';
import type { PageSize } from '@/watch/pagination';
import {
  buildPaletteItems,
  nextPaletteIndex,
  type PaletteItem,
} from "@/watch/command.ts";

type WatchCommandPaletteProps = {
  open: boolean;
  search: string;
  teamOnly: boolean;
  adminOnly: boolean;
  artifactOnly?: boolean;
  alerts: { id: number; title: string }[];
  sources: { key: string; name: string }[];
  releases: { id: number; coordinate: string }[];
  onClose: () => void;
};

export function WatchCommandPalette(props: WatchCommandPaletteProps) {
  return props.open ? <OpenCommandPalette {...props} /> : null;
}

function OpenCommandPalette({
  open,
  search,
  teamOnly,
  adminOnly,
  artifactOnly = false,
  alerts,
  sources,
  releases,
  onClose,
}: WatchCommandPaletteProps) {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const items = useMemo(
    () => buildPaletteItems({ query, search, teamOnly, adminOnly, artifactOnly, alerts, sources, releases }),
    [adminOnly, artifactOnly, alerts, query, releases, search, sources, teamOnly],
  );
  const active = items[activeIndex] ?? items[0] ?? null;
  const page = Math.floor((items[activeIndex] ? activeIndex : 0) / pageSize);
  const offset = page * pageSize;
  const visibleItems = items.slice(offset, offset + pageSize);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) activeOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open, active?.id]);

  const close = () => {
    setQuery("");
    setActiveIndex(0);
    onClose();
  };
  const choose = (item: PaletteItem) => {
    navigate(item.href);
    close();
  };
  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex((current) =>
        nextPaletteIndex(
          current,
          event.key as "ArrowDown" | "ArrowUp" | "Home" | "End",
          items.length,
        ),
      );
      return;
    }
    if (event.key === "Enter" && active) {
      event.preventDefault();
      choose(active);
    }
  };

  return (
    <Dialog open={open} onClose={close} initialFocus={inputRef} className="watch-design-surface relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/60 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 pt-[12vh]">
        <DialogPanel className="w-full max-w-[520px]">
        <motion.div className="watch-search-panel" initial={reduceMotion?false:{opacity:0}} animate={{opacity:1}} transition={{duration:reduceMotion?0:.12,ease:'easeOut'}}>
          <DialogTitle className="sr-only">Search or run a command</DialogTitle>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Search pages and commands"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={active ? `${listboxId}-${active.id}` : undefined}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={artifactOnly?'Search workspace pages…':'Search pages and records…'}
              className="h-14 w-full border-b border-white/8 bg-transparent pl-11 pr-24 text-sm text-snow outline-none placeholder:text-dim"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {query ? <button type="button" aria-label="Clear search" className="watch-search-control" onClick={() => {setQuery("");setActiveIndex(0);inputRef.current?.focus();}}><X className="size-4" aria-hidden /></button> : null}
              <button type="button" aria-label="Close search" className="watch-search-control" onClick={close}><span aria-hidden>Esc</span></button>
            </div>
          </div>
          {/* Listbox children must be options or option groups; the empty state is plain text, announced by the status line. */}
          <div id={listboxId} role={items.length ? "listbox" : undefined} aria-label={items.length ? "Search results" : undefined} className="watch-search-results max-h-80 overflow-auto py-2">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-snow">No results</p>
                <p className="mt-1 text-xs text-dim">{artifactOnly?'Try Releases, Team, Retention or Billing.':'Try another name, or search the full list on Coverage or Releases.'}</p>
              </div>
            ) : visibleItems.reduce<{group:string;entries:{item:typeof visibleItems[number];index:number}[]}[]>((groups, item, localIndex) => {
              const last = groups[groups.length - 1];
              const entry = { item, index: offset + localIndex };
              if (last && last.group === item.group) last.entries.push(entry);
              else groups.push({ group: item.group, entries: [entry] });
              return groups;
            }, []).map(({ group, entries }) => (
              <div key={`${group}-${entries[0].item.id}`} role="group" aria-label={group}>
                <p className="watch-search-group" aria-hidden="true">
                  {group}
                </p>
                {entries.map(({ item, index }) => {
                  const Icon = item.detail === "Alert"
                    ? Bell
                    : item.detail === "Release"
                      ? FileCheck2
                      : item.detail === "Source"
                        ? Box
                        : item.group === "Pages" ? PanelTop : ArrowRight;
                  return (
                    <button
                      key={item.id}
                      ref={active?.id === item.id ? activeOptionRef : undefined}
                      id={`${listboxId}-${item.id}`}
                      role="option"
                      aria-label={item.detail ? `${item.label}, ${item.detail}` : item.label}
                      aria-selected={active?.id === item.id}
                      type="button"
                      tabIndex={-1}
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-mute hover:bg-white/5 hover:text-snow aria-selected:bg-white/8 aria-selected:text-snow"
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={() => choose(item)}
                    >
                      <Icon className="size-4 shrink-0 text-dim" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.detail ? <span className="text-xs text-dim">{item.detail}</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="watch-search-help"><span role="status">{query.trim()?items.length>pageSize?`${items.length} matches`:`${items.length} ${items.length===1?'match':'matches'} shown`:'Quick navigation'}</span><span>↑ ↓ Navigate · Enter Open</span></div>
          {items.length > 10 ? <ListPagination label="Search results" pageSize={pageSize} onPageSizeChange={size=>{setPageSize(size);setActiveIndex(0);}} page={page} count={visibleItems.length} total={items.length} hasPrevious={page>0} hasNext={offset+pageSize<items.length} onPrevious={()=>setActiveIndex(offset-pageSize)} onNext={()=>setActiveIndex(offset+pageSize)}/> : null}
        </motion.div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

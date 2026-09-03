import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowRight, Bell, Box, FileCheck2, Search } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { navigate } from "@/nav.ts";
import {
  buildPaletteItems,
  nextPaletteIndex,
  type PaletteItem,
} from "@/watch/command.ts";

export function WatchCommandPalette({
  open,
  search,
  teamOnly,
  adminOnly,
  alerts,
  sources,
  releases,
  onClose,
}: {
  open: boolean;
  search: string;
  teamOnly: boolean;
  adminOnly: boolean;
  alerts: { id: number; title: string }[];
  sources: { key: string; name: string }[];
  releases: { id: number; coordinate: string }[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const items = useMemo(
    () => buildPaletteItems({ query, search, teamOnly, adminOnly, alerts, sources, releases }),
    [adminOnly, alerts, query, releases, search, sources, teamOnly],
  );
  const active = items[activeIndex] ?? items[0] ?? null;

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
    <Dialog open={open} onClose={close} initialFocus={inputRef} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/60 transition-opacity duration-150 data-closed:opacity-0 motion-reduce:transition-none" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 pt-[12vh]">
        <DialogPanel className="w-full max-w-lg overflow-hidden rounded-lg border border-white/10 bg-panel shadow-2xl transition duration-150 data-closed:-translate-y-2 data-closed:opacity-0 motion-reduce:transition-none">
          <DialogTitle className="sr-only">Search or run a command</DialogTitle>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
            <input
              ref={inputRef}
              role="combobox"
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
              placeholder="Search pages, alerts, sources…"
              className="h-12 w-full border-b border-white/8 bg-transparent pl-11 pr-4 text-sm text-snow outline-none placeholder:text-dim"
            />
          </div>
          <div id={listboxId} role="listbox" className="max-h-80 overflow-auto py-2">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm text-snow">No results</p>
                <p className="mt-1 text-xs text-dim">Try a page, alert, source, or release coordinate.</p>
              </div>
            ) : items.map((item, index) => {
              const Icon = item.detail === "Alert"
                ? Bell
                : item.detail === "Release"
                  ? FileCheck2
                  : item.detail === "Source"
                    ? Box
                    : ArrowRight;
              const showGroup = index === 0 || items[index - 1]?.group !== item.group;
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <p className="border-t border-white/8 px-4 pb-1 pt-3 text-xs uppercase tracking-[0.18em] text-dim first:border-0">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    id={`${listboxId}-${item.id}`}
                    role="option"
                    aria-selected={active?.id === item.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-mute hover:bg-white/5 hover:text-snow aria-selected:bg-white/8 aria-selected:text-snow"
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                  >
                    <Icon className="size-4 shrink-0 text-dim" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.detail ? <span className="text-xs text-dim">{item.detail}</span> : null}
                  </button>
                </div>
              );
            })}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

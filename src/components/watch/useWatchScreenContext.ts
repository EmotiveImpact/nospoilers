import { useContext } from "react";
import { WatchScreenContextValue } from "@/components/watch/WatchScreenContextValue";
import type { WatchScreenContext } from "@/components/watch/WatchScreenContext";

export function useWatchScreenContext(): WatchScreenContext {
  const value = useContext(WatchScreenContextValue);
  if (!value) throw new Error("Watch screen context is unavailable.");
  return value;
}

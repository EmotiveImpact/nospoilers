import { createContext } from "react";
import type { WatchScreenContext } from "@/components/watch/WatchScreenContext";

export const WatchScreenContextValue = createContext<WatchScreenContext | null>(null);

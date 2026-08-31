import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { navigate } from "@/nav.ts";
import { ScanPage } from "@/pages/ScanPage.tsx";
import { WatchPage } from "@/pages/WatchPage.tsx";

function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export default function App() {
  const path = usePath();
  const onScan = path === "/scan";

  return (
    <div className="min-h-svh bg-ink">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
          <button type="button" className="font-display text-[17px] tracking-tight text-snow" onClick={() => navigate("/")}>
            NoSpoilers
          </button>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button type="button" size="sm" variant="ghost" className={onScan ? "text-dim" : "text-snow"} onClick={() => navigate("/")}>
              Watch
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={onScan ? "text-snow" : "text-dim"}
              onClick={() => navigate("/scan")}
            >
              Scan
            </Button>
          </nav>
        </div>
      </header>
      {onScan ? <ScanPage /> : <WatchPage />}
    </div>
  );
}

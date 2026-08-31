import { useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";
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
    <div className="min-h-svh">
      <header className="border-b border-[#2c281f]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <button
            type="button"
            className="flex items-baseline gap-3"
            onClick={() => navigate("/")}
          >
            <Clapperboard className="h-4 w-4 text-[#c23b22]" aria-hidden />
            <p className="font-[Fraunces] text-xl tracking-tight text-[#f4ecda]">NoSpoilers</p>
          </button>
          <nav className="flex items-center gap-2">
            <Button type="button" size="sm" variant={onScan ? "ghost" : "default"} onClick={() => navigate("/")}>
              Watch
            </Button>
            <Button
              type="button"
              size="sm"
              variant={onScan ? "default" : "outline"}
              onClick={() => navigate("/scan")}
            >
              Scan pack
            </Button>
            <p className="hidden text-xs uppercase tracking-[0.22em] text-[#8a7f6c] sm:block">
              no spoilers in production
            </p>
          </nav>
        </div>
      </header>
      {onScan ? <ScanPage /> : <WatchPage />}
    </div>
  );
}

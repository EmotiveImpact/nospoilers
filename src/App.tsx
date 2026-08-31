import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"
import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"
import { ScanPage } from "@/pages/ScanPage.tsx"
import { WatchPage } from "@/pages/WatchPage.tsx"
import { useEffect, useState } from "react"

function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  return path
}

const tabClass =
  "rounded-full px-3.5 py-1.5 text-sm text-dim outline-none transition-colors data-hover:text-snow data-focus:ring-1 data-focus:ring-snow/30 data-selected:bg-snow data-selected:text-ink data-selected:data-hover:text-ink"

export default function App() {
  const path = usePath()
  const onScan = path === "/scan"

  return (
    <div className="min-h-svh bg-ink">
      <TabGroup
        selectedIndex={onScan ? 1 : 0}
        onChange={(index) => navigate(index === 1 ? "/scan" : "/")}
      >
        <header className="sticky top-0 z-10 border-b border-white/5 bg-ink/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
            <Button
              type="button"
              variant="ghost"
              className="h-auto px-0 font-display text-[17px] tracking-tight text-snow data-hover:bg-transparent data-hover:text-white"
              onClick={() => navigate("/")}
            >
              NoSpoilers
            </Button>
            <TabList className="flex rounded-full bg-white/[0.06] p-1">
              <Tab className={tabClass}>Watch</Tab>
              <Tab className={tabClass}>Scan</Tab>
            </TabList>
          </div>
        </header>
        <TabPanels>
          <TabPanel className="outline-none">
            <WatchPage />
          </TabPanel>
          <TabPanel className="outline-none">
            <ScanPage />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  )
}

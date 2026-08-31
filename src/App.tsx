import { SiteChrome } from "@/components/SiteChrome.tsx"
import { LandingPage } from "@/pages/LandingPage.tsx"
import { MockupsPage } from "@/pages/MockupsPage.tsx"
import { PricingPage } from "@/pages/PricingPage.tsx"
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

function pageFor(path: string): "home" | "watch" | "scan" | "pricing" | "mockups" {
  if (path === "/scan" || path.startsWith("/scan/")) return "scan"
  if (path === "/pricing" || path.startsWith("/pricing/")) return "pricing"
  if (path === "/watch" || path.startsWith("/watch/")) return "watch"
  if (path === "/mockups" || path === "/mockups/") return "mockups"
  return "home"
}

export default function App() {
  const path = usePath()
  const page = pageFor(path)
  const chromePath =
    page === "home"
      ? "/"
      : page === "watch"
        ? "/watch"
        : page === "scan"
          ? "/scan"
          : page === "pricing"
            ? "/pricing"
            : "/mockups"

  return (
    <SiteChrome path={chromePath}>
      {page === "home" && <LandingPage />}
      {page === "watch" && <WatchPage />}
      {page === "scan" && <ScanPage />}
      {page === "pricing" && <PricingPage />}
      {page === "mockups" && <MockupsPage />}
    </SiteChrome>
  )
}

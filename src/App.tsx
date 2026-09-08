import { V20PublicShell } from "@/components/marketing/V20PublicShell.tsx"
import { WebsitePage } from "@/pages/WebsitePage.tsx"
import { isWebsitePath } from "@/website/page-paths.ts"
import { SiteChrome } from "@/components/SiteChrome.tsx"
import { legalSlugFromPath } from "@/legal.ts"
import { LandingPage } from "@/pages/LandingPage.tsx"
import { DocsPage } from "@/pages/DocsPage.tsx"
import { LegalPage } from "@/pages/LegalPage.tsx"
import { MockupsPage } from "@/pages/MockupsPage.tsx"
import { PricingPage } from "@/pages/PricingPage.tsx"
import { ProspectsPage } from "@/pages/ProspectsPage.tsx"
import { ScanPage } from "@/pages/ScanPage.tsx"
import { StatusPage } from "@/pages/StatusPage.tsx"
import { AdvisoryPage } from "@/pages/AdvisoryPage.tsx"
import { VerifyPage } from "@/pages/VerifyPage.tsx"
import { WatchPage } from "@/pages/WatchPage.tsx"
import { useEffect, useState } from "react"

function readLoc() {
  return { path: window.location.pathname, search: window.location.search }
}

function useLoc(): { path: string; search: string } {
  const [loc, setLoc] = useState(readLoc)
  useEffect(() => {
    const onPop = () => setLoc(readLoc())
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])
  return loc
}

function pageFor(
  path: string,
): "home" | "watch" | "scan" | "pricing" | "docs" | "mockups" | "prospects" | "legal" | "status" | "verify" | "advisory" {
  if (legalSlugFromPath(path)) return "legal"
  if (path === "/internal/prospects") return "prospects"
  if (path === "/advisory" || path.startsWith("/advisory/")) return "advisory"
  if (path === "/verify" || path.startsWith("/verify/")) return "verify"
  if (path === "/status" || path.startsWith("/status/")) return "status"
  if (path === "/docs" || path.startsWith("/docs/")) return "docs"
  if (path === "/scan" || path.startsWith("/scan/")) return "scan"
  if (path === "/pricing" || path.startsWith("/pricing/")) return "pricing"
  if (path === "/watch" || path.startsWith("/watch/")) return "watch"
  if (path === "/mockups" || path === "/mockups/") return "mockups"
  return "home"
}

export default function App() {
  const { path, search } = useLoc()
  const page = pageFor(path)
  const legalSlug = legalSlugFromPath(path)
  const chromePath =
    page === "home"
      ? "/"
      : page === "watch"
        ? "/watch"
        : page === "scan"
          ? "/scan"
          : page === "pricing"
            ? "/pricing"
            : page === "docs"
              ? "/docs"
              : page === "mockups"
              ? "/mockups"
              : page === "legal"
                ? path.replace(/\/$/, "") || "/"
                : page === "status"
                  ? "/status"
                  : page === "verify"
                    ? path.replace(/\/$/, "") || "/verify"
                    : page === "advisory"
                      ? path.replace(/\/$/, "") || "/advisory"
                      : "/internal/prospects"

  // Documentation is a standalone reading workspace, not a marketing page.
  if (page === "docs") return <DocsPage path={path} />

  // Supporting public routes are isolated from authenticated application routing.
  if (isWebsitePath(path)) return <V20PublicShell><WebsitePage path={path} /></V20PublicShell>

  return (
    <SiteChrome path={chromePath} search={search}>
      {page === "home" && <LandingPage />}
      {page === "watch" && <WatchPage path={path} search={search} />}
      {page === "scan" && <ScanPage search={search} />}
      {page === "pricing" && <PricingPage />}
      {page === "mockups" && <MockupsPage />}
      {page === "prospects" && <ProspectsPage />}
      {page === "legal" && legalSlug && <LegalPage slug={legalSlug} />}
      {page === "status" && <StatusPage />}
      {page === "verify" && <VerifyPage path={path} />}
      {page === "advisory" && <AdvisoryPage path={path} />}
    </SiteChrome>
  )
}

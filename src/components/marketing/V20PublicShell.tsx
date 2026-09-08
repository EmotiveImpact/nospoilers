import { MarketingFooter, MarketingNav, type MarketingSession } from "@/components/marketing/V20Homepage.tsx"
import { navigate } from "@/nav.ts"
import { useEffect, useState, type ReactNode } from "react"
import "./v20-homepage.css"

export function V20PublicShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MarketingSession | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/me", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as MarketingSession
        if (!cancelled && response.ok) setMe(body)
      })
      .catch(() => {
        if (!cancelled) setMe({ user: null, githubApp: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openApp = () => {
    if (me?.user) navigate("/watch")
    else if (me?.githubApp) window.location.assign("/api/auth/github")
    else navigate("/watch")
  }

  return (
    <div className="v20-home v20-public-shell" id="top">
      <MarketingNav me={me} openApp={openApp} home={false} />
      <div className="v20-public-shell-content">{children}</div>
      <MarketingFooter home={false} />
    </div>
  )
}

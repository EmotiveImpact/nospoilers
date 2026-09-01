import { signOut } from "@/auth.ts"
import { LogInButton } from "@/components/AuthControls.tsx"
import { GithubMark } from "@/components/GithubMark.tsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Coverage } from "@/coverage.ts"
import { cn } from "@/lib/utils"
import { navigate } from "@/nav.ts"
import { Bell, CreditCard, FolderGit, LayoutDashboard, Menu, Scan } from "lucide-react"
import { useState, type MouseEvent, type ReactNode } from "react"

const ITEMS = [
  { href: "/watch", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "Scan pack", icon: Scan },
  { href: "/pricing", label: "Plans", icon: CreditCard },
] as const

function go(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  navigate(href)
}

function isActive(path: string, href: string): boolean {
  if (href === "/watch") return path === "/watch" || path.startsWith("/watch/")
  return path === href || path.startsWith(`${href}/`)
}

export function DashboardShell({
  path,
  login,
  coverage,
  githubApp,
  signedIn,
  children,
}: {
  path: string
  login: string | null
  coverage: Coverage | null
  githubApp: boolean
  signedIn: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ended = coverage?.status === "ended"

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const active = isActive(path, item.href)
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={(event) => {
              go(event, item.href)
              setOpen(false)
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-white/10 text-snow" : "text-mute hover:bg-white/[0.05] hover:text-snow",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </a>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-svh bg-ink">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/8 bg-panel/40 md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-white/8 px-4">
          <a href="/" onClick={(event) => go(event, "/")}>
            <img src="/logo.png" alt="NoSpoilers" className="h-6 w-auto" />
          </a>
        </div>
        <div className="flex-1 p-3">{nav}</div>
        <div className="border-t border-white/8 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-dim">Coverage</p>
          <p className="mt-1 text-sm text-mute">{coverage?.label ?? "Not signed in"}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-white/8 bg-ink/80 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 md:hidden"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open dashboard menu</span>
            </button>
            <div className="hidden items-center gap-2 text-sm text-mute sm:flex">
              <FolderGit className="h-4 w-4" aria-hidden />
              <span>GitHub watch</span>
              <Bell className="h-3.5 w-3.5 text-dim" aria-hidden />
              <span>Release packs</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {coverage ? <Badge variant={ended ? "ended" : "live"}>{coverage.label}</Badge> : null}
            {login ? <span className="hidden font-mono text-xs text-mute sm:inline">{login}</span> : null}
            {ended ? (
              <Button type="button" size="sm" onClick={() => navigate("/pricing")}>
                Subscribe
              </Button>
            ) : null}
            {signedIn ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            ) : (
              <LogInButton githubApp={githubApp} label="Log in" />
            )}
            {!signedIn && githubApp ? (
              <Button as="a" href="/api/auth/github" size="sm" className="hidden sm:inline-flex">
                <GithubMark />
                Trial
              </Button>
            ) : null}
          </div>
        </header>
        {open ? <div className="border-b border-white/8 p-3 md:hidden">{nav}</div> : null}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}

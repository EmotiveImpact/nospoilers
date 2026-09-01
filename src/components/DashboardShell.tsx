import { signOut } from "@/auth.ts"
import { Button } from "@/components/ui/button"
import type { Coverage } from "@/coverage.ts"
import { cn } from "@/lib/utils"
import { navigate } from "@/nav.ts"
import { LayoutDashboard, Menu, Scan, Settings } from "lucide-react"
import { useState, type MouseEvent, type ReactNode } from "react"

const ITEMS = [
  { href: "/watch", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "Scan pack", icon: Scan },
  { href: "/pricing", label: "Plans", icon: Settings },
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

function initials(login: string): string {
  const parts = login.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return login.slice(0, 2).toUpperCase()
}

export function DashboardShell({
  path,
  login,
  coverage,
  children,
}: {
  path: string
  login: string
  coverage: Coverage | null
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ended = coverage?.status === "ended"
  const title = path === "/scan" ? "Scan pack" : path === "/internal/prospects" ? "Leads" : "Dashboard"

  const nav = (
    <nav className="flex flex-col gap-1 px-3" aria-label="Account">
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
              "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium",
              active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {item.label}
          </a>
        )
      })}
    </nav>
  )

  return (
    <div className="atlas flex min-h-svh bg-[#0c0e12] text-zinc-100">
      <aside className="hidden w-[15.5rem] shrink-0 flex-col border-r border-white/8 bg-[#101218] md:flex">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <a href="/" onClick={(event) => go(event, "/")} className="flex items-center gap-2.5">
            <img src="/logo.png" alt="NoSpoilers" className="h-6 w-auto" />
          </a>
        </div>
        <div className="flex-1 pt-2">{nav}</div>
        <div className="border-t border-white/8 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
              {initials(login)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-white">{login}</p>
              <p className={cn("truncate text-xs", ended ? "text-red-400" : "text-zinc-500")}>
                {coverage?.label ?? "Coverage"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-white/8 bg-[#0c0e12] px-4 md:px-6">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </button>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">NoSpoilers</p>
            <h1 className="text-sm font-medium text-white">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {ended ? (
              <Button type="button" size="sm" onClick={() => navigate("/pricing")}>
                Subscribe
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </header>
        {open ? <div className="border-b border-white/8 py-3 md:hidden">{nav}</div> : null}
        <div className="min-h-0 flex-1 overflow-auto bg-[#0c0e12]">{children}</div>
      </div>
    </div>
  )
}

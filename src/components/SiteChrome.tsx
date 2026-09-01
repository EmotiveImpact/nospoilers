import { signOut } from "@/auth.ts"
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
import { LogInButton } from "@/components/AuthControls.tsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { coverageFromQuery, type Coverage } from "@/coverage.ts"
import { cn } from "@/lib/utils"
import { navigate } from "@/nav.ts"
import { GithubMark } from "@/components/GithubMark.tsx"
import { Menu as MenuIcon } from "lucide-react"
import { useEffect, useState, type MouseEvent, type ReactNode } from "react"

const LINKS = [
  { href: "/", label: "Product" },
  { href: "/watch", label: "Watch" },
  { href: "/scan", label: "Scan" },
  { href: "/pricing", label: "Pricing" },
] as const

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/"
  return path === href || path.startsWith(`${href}/`)
}

function go(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  navigate(href)
}

function productHref(href: string, search: string, signedIn: boolean): string {
  if (signedIn) return href
  const as = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("as")
  if (href === "/watch") return as === "ended" ? "/watch?as=ended" : "/watch?as=trial"
  if (href === "/scan") {
    if (as === "ended") return "/scan?as=ended"
    if (as === "trial") return "/scan?as=trial"
  }
  return href
}

export function SiteChrome({
  path,
  search,
  children,
}: {
  path: string
  search: string
  children: ReactNode
}) {
  const [sessionCoverage, setSessionCoverage] = useState<Coverage | null>(null)
  const [login, setLogin] = useState<string | null>(null)
  const [githubApp, setGithubApp] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/me", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as {
          coverage?: Coverage
          user?: { login: string } | null
          githubApp?: boolean
        }
        if (cancelled) return
        setGithubApp(Boolean(body.githubApp))
        if (body.user && body.coverage) {
          setSessionCoverage(body.coverage)
          setLogin(body.user.login)
        } else {
          setSessionCoverage(null)
          setLogin(null)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [path, search])

  const preview = coverageFromQuery(search)
  const coverage = sessionCoverage ?? preview
  const ended = coverage?.status === "ended"
  const signedIn = Boolean(login)
  const previewing = Boolean(coverage) && !signedIn
  const home = path === "/"

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b border-white/6 bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5">
          <a href="/" className="shrink-0" onClick={(event) => go(event, "/")}>
            <img src="/logo.png" alt="NoSpoilers" className="h-7 w-auto sm:h-8" />
          </a>
          <nav className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1 md:flex" aria-label="Primary">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={productHref(link.href, search, signedIn)}
                onClick={(event) => go(event, productHref(link.href, search, signedIn))}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  isActive(path, link.href) ? "bg-white/10 text-snow" : "text-dim hover:text-snow",
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {coverage && (
              <Badge variant={ended ? "ended" : "live"} className="hidden sm:inline-flex">
                {coverage.label}
              </Badge>
            )}
            {login && <span className="hidden font-mono text-xs text-mute lg:inline">{login}</span>}
            {ended ? (
              <Button type="button" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/pricing")}>
                Subscribe
              </Button>
            ) : null}
            {signedIn ? (
              <Button type="button" size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => void signOut()}>
                Sign out
              </Button>
            ) : (
              <>
                <span className="hidden sm:inline-flex">
                  <LogInButton githubApp={githubApp} label="Log in" />
                </span>
                {!previewing && !home &&
                  (githubApp ? (
                    <Button as="a" href="/api/auth/github" size="sm" className="hidden sm:inline-flex">
                      <GithubMark />
                      Start trial
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="hidden sm:inline-flex"
                      onClick={() => navigate("/watch?as=trial")}
                    >
                      Start trial
                    </Button>
                  ))}
              </>
            )}
            <Menu>
              <MenuButton className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 text-snow data-hover:bg-white/5 data-focus:outline-none data-focus:ring-1 data-focus:ring-snow/40 md:hidden">
                <MenuIcon className="h-4 w-4" aria-hidden />
                <span className="sr-only">Open menu</span>
              </MenuButton>
              <MenuItems
                anchor="bottom end"
                className="z-30 mt-2 w-56 origin-top-right rounded-xl border border-white/10 bg-panel p-1.5 shadow-xl outline-none"
              >
                {LINKS.map((link) => (
                  <MenuItem key={link.href}>
                    <a
                      href={productHref(link.href, search, signedIn)}
                      onClick={(event) => go(event, productHref(link.href, search, signedIn))}
                      className="block rounded-lg px-3 py-2 text-sm text-mute data-focus:bg-white/5 data-focus:text-snow"
                    >
                      {link.label}
                    </a>
                  </MenuItem>
                ))}
                {signedIn ? (
                  <MenuItem>
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-snow data-focus:bg-white/5"
                      onClick={() => void signOut()}
                    >
                      Sign out
                    </button>
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem>
                      {githubApp ? (
                        <a href="/api/auth/github" className="block rounded-lg px-3 py-2 text-sm text-snow data-focus:bg-white/5">
                          Log in with GitHub
                        </a>
                      ) : (
                        <span className="block rounded-lg px-3 py-2 text-sm text-dim">Log in (GitHub App not set)</span>
                      )}
                    </MenuItem>
                    <MenuItem>
                      <a
                        href="/watch?as=trial"
                        onClick={(event) => go(event, "/watch?as=trial")}
                        className="block rounded-lg px-3 py-2 text-sm text-snow data-focus:bg-white/5"
                      >
                        Preview the desk
                      </a>
                    </MenuItem>
                  </>
                )}
              </MenuItems>
            </Menu>
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-white/6">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-3">
          <div>
            <img src="/logo.png" alt="" className="h-6 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-dim">
              No spoilers in production. We watch GitHub, then we open the pack people actually
              download.
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Product</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-mute">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-snow" onClick={(event) => go(event, link.href)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Coverage</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-mute">
              <li>Solo $29 / month</li>
              <li>Team $99 / month</li>
              <li>14-day full trial</li>
              <li>Yearly: 10 months for the price of 12</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-white/6 px-5 py-5 text-xs text-dim sm:flex-row sm:justify-between">
          <p>Hosted unpacks stop when coverage ends. The CLI on your machine does not.</p>
          <p>
            <code className="text-mute">npx nospoilers scan ./package.tgz</code>
          </p>
        </div>
      </footer>
    </div>
  )
}

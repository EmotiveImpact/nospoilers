import { signOut } from "@/auth.ts"
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react"
import { LogInButton } from "@/components/AuthControls.tsx"
import { Button } from "@/components/ui/button"
import { coverageFromQuery, type Coverage } from "@/coverage.ts"
import { LEGAL_NAV } from "@/legal.ts"
import { cn } from "@/lib/utils"
import { navigate } from "@/nav.ts"
import { Menu as MenuIcon } from "lucide-react"
import { useEffect, useState, type MouseEvent, type ReactNode } from "react"

const LINKS = [
  { href: "/", label: "Product" },
  { href: "/watch", label: "Watch" },
  { href: "/scan", label: "Scan" },
  { href: "/pricing", label: "Pricing" },
] as const

const FOOTER_PRODUCT = [...LINKS, { href: "/status", label: "Status" }] as const

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

  return (
    <div className="flex min-h-svh flex-col bg-ink">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5">
          <a href="/" className="shrink-0" onClick={(event) => go(event, "/")}>
            <img src="/logo.png" alt="NoSpoilers" className="h-7 w-auto sm:h-8" />
          </a>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={productHref(link.href, search, signedIn)}
                onClick={(event) => go(event, productHref(link.href, search, signedIn))}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive(path, link.href) ? "text-snow" : "text-dim hover:text-snow",
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {coverage && (
              <span
                className={cn(
                  "hidden text-[11px] uppercase tracking-[0.16em] sm:inline",
                  ended ? "text-danger" : "text-dim",
                )}
              >
                {coverage.label}
              </span>
            )}
            {login && <span className="hidden text-sm text-mute sm:inline">{login}</span>}
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
                  <LogInButton githubApp={githubApp} />
                </span>
                {!previewing &&
                  (githubApp ? (
                    <Button as="a" href="/api/auth/github" size="sm" className="hidden sm:inline-flex">
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
              <MenuButton className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-snow data-hover:bg-white/5 data-focus:outline-none data-focus:ring-1 data-focus:ring-snow/40 md:hidden">
                <MenuIcon className="h-4 w-4" aria-hidden />
                <span className="sr-only">Open menu</span>
              </MenuButton>
              <MenuItems
                anchor="bottom end"
                className="z-30 mt-2 w-52 origin-top-right rounded-md border border-white/10 bg-ink p-1 shadow-xl outline-none"
              >
                {LINKS.map((link) => (
                  <MenuItem key={link.href}>
                    <a
                      href={productHref(link.href, search, signedIn)}
                      onClick={(event) => go(event, productHref(link.href, search, signedIn))}
                      className="block rounded px-3 py-2 text-sm text-mute data-focus:bg-white/5 data-focus:text-snow"
                    >
                      {link.label}
                    </a>
                  </MenuItem>
                ))}
                {signedIn ? (
                  <MenuItem>
                    <button
                      type="button"
                      className="block w-full rounded px-3 py-2 text-left text-sm text-snow data-focus:bg-white/5"
                      onClick={() => void signOut()}
                    >
                      Sign out
                    </button>
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem>
                      {githubApp ? (
                        <a href="/api/auth/github" className="block rounded px-3 py-2 text-sm text-snow data-focus:bg-white/5">
                          Log in
                        </a>
                      ) : (
                        <span className="block rounded px-3 py-2 text-sm text-dim">Log in (GitHub App not set)</span>
                      )}
                    </MenuItem>
                    <MenuItem>
                      <a
                        href="/watch?as=trial"
                        onClick={(event) => go(event, "/watch?as=trial")}
                        className="block rounded px-3 py-2 text-sm text-snow data-focus:bg-white/5"
                      >
                        Start trial
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
      <footer className="border-t border-white/5">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <img src="/logo.png" alt="" className="h-6 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-dim">
              No spoilers in production. Coverage on GitHub visibility and the packed bytes
              customers download.
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Product</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-mute">
              {FOOTER_PRODUCT.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="hover:text-snow" onClick={(event) => go(event, link.href)}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-dim">Legal</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-mute">
              {LEGAL_NAV.map((link) => (
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
              <li>Yearly: 10 for the price of 12</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-5xl flex-col gap-2 border-t border-white/5 px-5 py-5 text-xs text-dim sm:flex-row sm:justify-between">
          <p>NoSpoilers. Hosted unpacks stop when coverage ends. The CLI on your machine does not.</p>
          <p>
            <code className="text-mute">npx nospoilers scan ./package.tgz</code>
          </p>
        </div>
      </footer>
    </div>
  )
}

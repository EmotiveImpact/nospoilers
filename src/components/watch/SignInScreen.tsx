import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { navigate } from "@/nav"
import { emailAuthEntry, type EmailAuthMode as Mode } from "@/watch/email-auth-entry"
import { SignInExplainer } from "./SignInExplainer"
import "./sign-in-scene.css"

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

const fieldClass =
  "mt-1.5 block h-10 w-full min-w-0 rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow placeholder:text-dim focus:border-white/35 focus:outline-none"
const linkClass = "text-mute underline-offset-4 hover:text-snow hover:underline"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-mute">
      {label}
      {children}
    </label>
  )
}

function ProductLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      className={`text-sm text-mute underline-offset-4 hover:text-snow hover:underline ${className}`}
      onClick={(event) => {
        event.preventDefault()
        navigate("/")
      }}
    >
      Back to product
    </a>
  )
}

/**
 * The signed-out Watch screen. Every step (sign in, create account, reset,
 * check inbox) replaces the whole screen rather than stacking under it.
 */
export function SignInScreen({
  path,
  search,
  githubApp,
  developmentLogin,
  emailAuth,
}: {
  path: string
  search: string
  githubApp: boolean
  developmentLogin?: boolean
  emailAuth?: boolean
}) {
  const entry = emailAuthEntry(path, search)
  const [mode, setMode] = useState<Mode>(emailAuth ? entry.mode : "sign-in")
  const [notice, setNotice] = useState(emailAuth ? entry.notice : "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const passwordHelpId = useId()
  const errorId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const shownMode = useRef(mode)

  // A step change replaces the screen: move focus to its heading so keyboard
  // and screen-reader users start at the top of the new step.
  useEffect(() => {
    if (shownMode.current === mode) return
    shownMode.current = mode
    heading.current?.focus()
  }, [mode])

  function switchTo(next: Mode) {
    setMode(next)
    setError("")
    setNotice("")
    setPassword("")
  }

  async function post(route: string, body: Record<string, string>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const response = await fetch(route, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: response.ok, data }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      if (mode === "sign-in" || mode === "sign-up") {
        const result = await post(`/api/auth/email/${mode}`, mode === "sign-up" ? { name, email, password } : { email, password })
        if (result.ok && typeof result.data.redirect === "string" && result.data.redirect.startsWith("/")) {
          window.location.assign(result.data.redirect)
          return
        }
        if (result.ok && result.data.status === "verify_email") { setPassword(""); setMode("verify"); return }
        setError(typeof result.data.error === "string" ? result.data.error : "Sign-in failed. Try again.")
      } else if (mode === "forgot") {
        const result = await post("/api/auth/email/password-reset", { email })
        if (result.ok) { setMode("sent"); return }
        setError(typeof result.data.error === "string" ? result.data.error : "The reset email could not be requested.")
      } else if (mode === "reset") {
        const result = await post("/api/auth/email/reset-password", { token: entry.token, password })
        if (result.ok) {
          // Drop the single-use token from the address bar and history.
          window.history.replaceState({}, "", "/watch")
          setPassword("")
          setMode("reset-done")
          return
        }
        setError(typeof result.data.error === "string" ? result.data.error : "The password could not be reset.")
      }
    } catch {
      setError("NoSpoilers could not be reached. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  const titles: Record<Mode, [string, string]> = {
    "sign-in": [
      "Sign in and get to work.",
      emailAuth
        ? "Use your email or GitHub to open your workspace and start the real 5-day billing trial."
        : "Sign in with GitHub to open your workspace and start the real 5-day billing trial.",
    ],
    "sign-up": ["Create your account", "Start the real 5-day billing trial. You can connect GitHub to a workspace later."],
    forgot: ["Reset your password", "Enter the email you signed up with and we will send a reset link."],
    reset: ["Choose a new password", "Pick a password you have not used here before."],
    verify: ["Check your inbox", `We sent a verification link to ${email}. Open it, then sign in.`],
    sent: ["Check your inbox", `If an account uses ${email}, a password reset link is on its way.`],
    "reset-done": ["Password updated", "Sign in with your new password."],
  }
  const [title, lead] = titles[mode]
  const statusStep = mode === "verify" || mode === "sent" || mode === "reset-done"
  const showGithub = mode === "sign-in" || mode === "sign-up"
  const newPassword = mode === "sign-up" || mode === "reset"
  const action = { "sign-in": "Sign in", "sign-up": "Create account", forgot: "Send reset link", reset: "Update password" } as const

  const githubAction = githubApp ? (
    <Button as="a" href="/api/auth/github" size="lg" variant={emailAuth ? "outline" : "default"} className="w-full">
      {mode === "sign-up" ? "Continue with GitHub" : "Sign in with GitHub"}
    </Button>
  ) : developmentLogin ? (
    <Button as="a" href="/api/auth/development" size="lg" variant={emailAuth ? "outline" : "default"} className="w-full">
      Open local review workspace
    </Button>
  ) : emailAuth ? null : (
    <Button type="button" size="lg" disabled className="w-full" title="GitHub authentication is not configured on this host.">
      GitHub sign-in unavailable
    </Button>
  )

  return (
    <main className="min-h-svh bg-canvas lg:grid lg:grid-cols-2">
      <aside className="sign-in-scene hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-12">
        <p className="watch-kicker relative z-[1]">Watch desk</p>
        <SignInExplainer />
        <ProductLink className="relative z-[1] self-start" />
      </aside>

      <section className="flex min-h-svh flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center justify-between lg:hidden">
          <p className="watch-kicker">Watch desk</p>
          <ProductLink />
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-12">
          <h1
            ref={heading}
            tabIndex={-1}
            className="font-display text-3xl leading-[1.1] tracking-tight text-snow focus:outline-none md:text-4xl"
          >
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-mute" role={statusStep ? "status" : undefined}>{lead}</p>
          {notice ? <p className="mt-4 rounded-md border border-line px-3 py-2 text-sm text-snow" role="status">{notice}</p> : null}

          {statusStep ? (
            <Button type="button" size="lg" className="mt-8 w-full" onClick={() => switchTo("sign-in")}>
              Back to sign in
            </Button>
          ) : (
            <div className="mt-8">
              {showGithub && githubAction ? (
                <>
                  {githubAction}
                  {emailAuth ? (
                    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-dim" aria-hidden="true">
                      <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
                    </div>
                  ) : null}
                </>
              ) : null}

              {emailAuth ? (
                <form className="space-y-4" onSubmit={event => void submit(event)} aria-describedby={error ? errorId : undefined}>
                  {mode === "sign-up" ? (
                    <Field label="Name">
                      <input className={fieldClass} required maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} />
                    </Field>
                  ) : null}
                  {mode !== "reset" ? (
                    <Field label="Email">
                      <input className={fieldClass} type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
                    </Field>
                  ) : null}
                  {mode !== "forgot" ? (
                    <Field label={newPassword ? "New password" : "Password"}>
                      <input
                        className={fieldClass}
                        type="password"
                        required
                        minLength={newPassword ? PASSWORD_MIN : undefined}
                        maxLength={PASSWORD_MAX}
                        autoComplete={newPassword ? "new-password" : "current-password"}
                        aria-describedby={newPassword ? passwordHelpId : undefined}
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                      />
                    </Field>
                  ) : null}
                  {newPassword ? (
                    <p id={passwordHelpId} className="-mt-2.5 text-xs text-dim">{PASSWORD_MIN} to {PASSWORD_MAX} characters.</p>
                  ) : null}
                  {mode === "sign-in" ? (
                    <p className="-mt-1 text-right text-sm">
                      <button type="button" className={linkClass} onClick={() => switchTo("forgot")}>Forgot password?</button>
                    </p>
                  ) : null}
                  {error ? <p id={errorId} className="text-sm text-danger" role="alert">{error}</p> : null}
                  <Button type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : action[mode as keyof typeof action]}
                  </Button>
                </form>
              ) : null}

              {emailAuth ? (
                <p className="mt-6 text-center text-sm text-mute">
                  {mode === "sign-in" ? (
                    <>New to NoSpoilers? <button type="button" className={`${linkClass} text-snow`} onClick={() => switchTo("sign-up")}>Create an account</button></>
                  ) : mode === "sign-up" ? (
                    <>Already have an account? <button type="button" className={`${linkClass} text-snow`} onClick={() => switchTo("sign-in")}>Sign in</button></>
                  ) : (
                    <button type="button" className={linkClass} onClick={() => switchTo("sign-in")}>Back to sign in</button>
                  )}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

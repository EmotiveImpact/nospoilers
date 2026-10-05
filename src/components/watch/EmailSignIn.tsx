import { useId, useState, type FormEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { emailAuthEntry, type EmailAuthMode as Mode } from "@/watch/email-auth-entry"

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

const fieldClass =
  "mt-1.5 block h-10 w-full min-w-0 rounded-md border border-white/15 bg-transparent px-3 text-sm text-snow placeholder:text-dim focus:border-white/35 focus:outline-none"

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-mute">
      {label}
      {children}
    </label>
  )
}

export function EmailSignIn({ path, search }: { path: string; search: string }) {
  const entry = emailAuthEntry(path, search)
  const [mode, setMode] = useState<Mode>(entry.mode)
  const [notice, setNotice] = useState(entry.notice)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const passwordHelpId = useId()
  const errorId = useId()

  function switchTo(next: Mode) {
    setMode(next)
    setError("")
    setNotice("")
    setPassword("")
  }

  async function post(route: string, body: Record<string, string>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
    const response = await fetch(route, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: response.ok, status: response.status, data }
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

  if (mode === "verify" || mode === "sent" || mode === "reset-done") {
    const copy = {
      verify: ["Check your inbox", `We sent a verification link to ${email}. Open it, then sign in here.`],
      sent: ["Check your inbox", `If an account uses ${email}, a password reset link is on its way.`],
      "reset-done": ["Password updated", "Sign in with your new password."],
    }[mode]
    return (
      <section aria-labelledby="email-auth-status" className="mt-8 border-t border-line pt-6">
        <h2 id="email-auth-status" className="text-base font-medium text-snow">{copy[0]}</h2>
        <p className="mt-2 text-sm leading-relaxed text-mute" role="status">{copy[1]}</p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => switchTo("sign-in")}>
          Back to sign in
        </Button>
      </section>
    )
  }

  const heading = { "sign-in": "Sign in with email", "sign-up": "Create an account", forgot: "Reset your password", reset: "Choose a new password" }[mode]
  const action = { "sign-in": "Sign in", "sign-up": "Create account", forgot: "Send reset link", reset: "Update password" }[mode]
  const needsPassword = mode !== "forgot"
  const newPassword = mode === "sign-up" || mode === "reset"

  return (
    <section aria-labelledby="email-auth-heading" className="mt-8 border-t border-line pt-6">
      <h2 id="email-auth-heading" className="text-base font-medium text-snow">{heading}</h2>
      {notice ? <p className="mt-2 text-sm text-mute" role="status">{notice}</p> : null}
      <form className="mt-4 space-y-4" onSubmit={event => void submit(event)} aria-describedby={error ? errorId : undefined}>
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
        {needsPassword ? (
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
        {needsPassword && newPassword ? (
          <p id={passwordHelpId} className="-mt-2.5 text-xs text-dim">{PASSWORD_MIN} to {PASSWORD_MAX} characters.</p>
        ) : null}
        {error ? <p id={errorId} className="text-sm text-danger" role="alert">{error}</p> : null}
        <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
          {busy ? "Please wait…" : action}
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {mode === "sign-in" ? (
          <>
            <button type="button" className="text-mute underline-offset-4 hover:text-snow hover:underline" onClick={() => switchTo("sign-up")}>Create an account</button>
            <button type="button" className="text-mute underline-offset-4 hover:text-snow hover:underline" onClick={() => switchTo("forgot")}>Forgot password?</button>
          </>
        ) : (
          <button type="button" className="text-mute underline-offset-4 hover:text-snow hover:underline" onClick={() => switchTo("sign-in")}>
            {mode === "sign-up" ? "Already have an account? Sign in" : "Back to sign in"}
          </button>
        )}
      </div>
    </section>
  )
}

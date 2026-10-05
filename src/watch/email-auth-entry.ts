export type EmailAuthMode = "sign-in" | "sign-up" | "forgot" | "reset" | "verify" | "sent" | "reset-done"

const RESET_PATH = /^\/watch\/reset-password(?:\/([A-Za-z0-9_-]+\.[0-9a-f]{64}))?$/

/** Reads Better Auth's verification and reset redirects back into Watch. */
export function emailAuthEntry(path: string, search: string): { mode: EmailAuthMode; token: string; hint: string; notice: string } {
  const params = new URLSearchParams(search)
  const reset = RESET_PATH.exec(path.replace(/\/$/, ""))
  if (reset) {
    const token = params.get("token") ?? ""
    // The hint is minted by the server; it lets a completed reset sign out older sessions.
    if (token && !params.get("error")) return { mode: "reset", token, hint: reset[1] ?? "", notice: "" }
    return { mode: "forgot", token: "", hint: "", notice: "This reset link is invalid or has expired. Request a new one." }
  }
  if (params.get("verified") === "1") return { mode: "sign-in", token: "", hint: "", notice: "Email verified. Sign in to open your workspace." }
  return { mode: "sign-in", token: "", hint: "", notice: "" }
}

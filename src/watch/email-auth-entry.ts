export type EmailAuthMode = "sign-in" | "sign-up" | "forgot" | "reset" | "verify" | "sent" | "reset-done"

/** Reads Better Auth's verification and reset redirects back into Watch. */
export function emailAuthEntry(path: string, search: string): { mode: EmailAuthMode; token: string; notice: string } {
  const params = new URLSearchParams(search)
  if (path.replace(/\/$/, "") === "/watch/reset-password") {
    const token = params.get("token") ?? ""
    if (token && !params.get("error")) return { mode: "reset", token, notice: "" }
    return { mode: "forgot", token: "", notice: "This reset link is invalid or has expired. Request a new one." }
  }
  if (params.get("verified") === "1") return { mode: "sign-in", token: "", notice: "Email verified. Sign in to open your workspace." }
  return { mode: "sign-in", token: "", notice: "" }
}

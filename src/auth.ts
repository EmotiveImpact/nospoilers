export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
  window.location.assign("/")
}

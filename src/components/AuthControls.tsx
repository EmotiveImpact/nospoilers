import { Button } from "@/components/ui/button"

export function LogInButton({
  githubApp,
  size = "sm",
}: {
  githubApp: boolean
  size?: "sm" | "lg"
}) {
  if (githubApp) {
    return (
      <Button as="a" href="/api/auth/github" variant="ghost" size={size}>
        Log in
      </Button>
    )
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled
      title="Create the GitHub App and put the keys in .env. Until then Sign in stays off."
    >
      Log in
    </Button>
  )
}

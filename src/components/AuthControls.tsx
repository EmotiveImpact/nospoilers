import { GithubMark } from "@/components/GithubMark.tsx"
import { Button } from "@/components/ui/button"

export function LogInButton({
  githubApp,
  size = "sm",
  label = "Log in with GitHub",
}: {
  githubApp: boolean
  size?: "sm" | "lg"
  label?: string
}) {
  if (githubApp) {
    return (
      <Button as="a" href="/api/auth/github" variant="ghost" size={size}>
        <GithubMark />
        {label}
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
      <GithubMark />
      {label}
    </Button>
  )
}

import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"
import type { ReactNode } from "react"

export function CoverageLock({
  title,
  variant = "scan",
  children,
}: {
  title: string
  variant?: "scan" | "watch"
  children?: ReactNode
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-center gap-3 bg-ink/90 p-6 backdrop-blur-[1px]">
      <p className="text-[11px] uppercase tracking-[0.2em] text-danger">
        {variant === "scan" ? "Hosted scan is off" : "Hosted coverage is off"}
      </p>
      <h2 className="font-display text-2xl tracking-tight text-snow">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-mute">
        {variant === "scan"
          ? "Solo $29/mo or Team $99/mo. Same GitHub install. Scanning, jobs, and alerts start again. Existing receipts remain verifiable."
          : "Trial ended. We stop new jobs and scans until Solo $29 or Team $99 is active. Repos stay listed. Existing alerts can still be acknowledged and resolved."}
      </p>
      {children}
      <div className="mt-1 flex flex-wrap gap-2">
        <Button type="button" onClick={() => navigate("/pricing")}>
          See plans
        </Button>
        {variant === "scan" ? (
          <Button type="button" variant="outline" onClick={() => navigate("/watch")}>
            Watch desk
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => navigate("/watch/scan")}>
            New scan
          </Button>
        )}
      </div>
    </div>
  )
}

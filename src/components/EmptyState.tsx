import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string
  body: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-10",
        className,
      )}
    >
      <p className="font-display text-lg tracking-tight text-snow">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-mute">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

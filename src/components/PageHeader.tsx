import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
  size = "page",
}: {
  kicker?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  size?: "page" | "hero"
}) {
  return (
    <div className={cn("flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="max-w-3xl">
        {kicker ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-dim">{kicker}</p>
        ) : null}
        <h1
          className={cn(
            "font-display leading-[1.06] tracking-tight text-snow",
            kicker && "mt-3",
            size === "hero" ? "text-[2.35rem] sm:text-6xl md:text-7xl" : "text-4xl md:text-5xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-xl text-base leading-relaxed text-mute md:text-lg">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}

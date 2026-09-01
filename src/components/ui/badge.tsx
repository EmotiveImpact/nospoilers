import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        critical: "border-danger/30 bg-danger/10 text-danger",
        warn: "border-signal/30 bg-signal/10 text-signal",
        clean: "border-ok/30 bg-ok/10 text-ok",
        muted: "border-white/10 bg-white/[0.04] text-dim",
        live: "border-ok/25 bg-ok/10 text-ok",
        ended: "border-danger/30 bg-danger/10 text-danger",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        critical: "border-[#c23b22]/40 bg-[#c23b22]/15 text-[#f0b4a8]",
        warn: "border-[#c9a227]/40 bg-[#c9a227]/15 text-[#ead48a]",
        clean: "border-[#3d6b4f]/40 bg-[#3d6b4f]/15 text-[#b7d4c2]",
        muted: "border-[#3a3428] bg-[#1c1914] text-[#a39882]",
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

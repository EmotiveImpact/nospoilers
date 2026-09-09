import { Button as HeadlessButton } from "@headlessui/react"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentPropsWithoutRef, ElementType } from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "quiet-shared-button inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition-colors data-focus:outline-none data-focus:ring-1 data-focus:ring-snow/40 data-disabled:pointer-events-none data-disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-snow text-ink data-hover:bg-white data-active:bg-zinc-200",
        outline:
          "border border-white/15 bg-transparent text-snow data-hover:border-white/30 data-hover:bg-white/[0.04] data-active:bg-white/[0.07]",
        ghost: "text-mute data-hover:bg-white/[0.05] data-hover:text-snow data-active:bg-white/[0.08]",
        danger: "text-danger data-hover:text-snow",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

type ButtonProps<T extends ElementType = "button"> = {
  as?: T
  className?: string
} & VariantProps<typeof buttonVariants> &
  Omit<ComponentPropsWithoutRef<T>, "as" | "className">

function Button<T extends ElementType = "button">({
  as,
  className,
  variant,
  size,
  ...props
}: ButtonProps<T>) {
  const Comp = (as ?? "button") as "button"
  return (
    <HeadlessButton
      as={Comp}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button }

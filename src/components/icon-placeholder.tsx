import type { LucideIcon } from "lucide-react"
import * as Lucide from "lucide-react"

type Props = {
  lucide?: string
  hugeicons?: string
  phosphor?: string
  remixicon?: string
  tabler?: string
  className?: string
}

function lucideName(raw: string): string {
  return raw.endsWith("Icon") ? raw.slice(0, -4) : raw
}

export function IconPlaceholder({ lucide = "Circle", className }: Props) {
  const name = lucideName(lucide)
  const icons = Lucide as unknown as Record<string, LucideIcon | undefined>
  const Comp = icons[name] ?? Lucide.Circle
  return <Comp className={className} />
}

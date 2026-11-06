import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** One shared delay for every tooltip in the app. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={150}>{children}</TooltipPrimitive.Provider>;
}

/** Short label for an icon-only control, with an optional keyboard shortcut. */
export function Tooltip({ label, shortcut, children, side = "bottom" }: { label: string; shortcut?: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    // A local provider keeps tooltips working in isolated renders; the app-wide one still sets the shared delay.
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={150}>
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="ns-tooltip">
          {label}
          {shortcut ? <kbd>{shortcut}</kbd> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

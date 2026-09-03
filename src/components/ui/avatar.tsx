import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export function Avatar({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

export function AvatarImage({ className, alt = "", ...props }: ComponentProps<"img">) {
  return (
    <img
      alt={alt}
      className={cn("absolute inset-0 z-10 size-full object-cover", className)}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("grid size-full place-items-center bg-white/8 text-xs text-snow", className)}
      {...props}
    />
  );
}

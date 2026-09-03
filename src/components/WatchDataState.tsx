import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WatchSectionState } from "@/watch/data-state";

export type { WatchSectionState } from "@/watch/data-state";

export function WatchSkeleton({
  variant = "cards",
  className,
}: {
  variant?: "cards" | "list" | "detail";
  className?: string;
}) {
  const rows = variant === "detail" ? 3 : variant === "list" ? 6 : 4;
  return (
    <div
      className={cn(
        "animate-pulse motion-reduce:animate-none",
        variant === "cards" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "space-y-px",
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={cn(
            "bg-panel",
            variant === "cards"
              ? "h-28 rounded-lg border border-white/8 p-4"
              : variant === "detail"
                ? "h-28 rounded-lg border border-white/8"
                : "h-[68px] border-b border-white/5 px-4 py-3",
          )}
        >
          <div className="h-3 w-24 rounded bg-white/8" />
          <div className="mt-3 h-4 w-2/3 rounded bg-white/5" />
        </div>
      ))}
      <span className="sr-only">Loading this section…</span>
    </div>
  );
}

export function WatchSectionError({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-danger/25 bg-danger/8 p-4 sm:flex-row sm:items-center",
        className,
      )}
      role="alert"
    >
      <AlertCircle className="size-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-snow">This section did not load.</p>
        <p className="mt-1 text-xs leading-relaxed text-mute">{message}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RotateCw className="size-3.5" aria-hidden />
        Retry
      </Button>
    </div>
  );
}

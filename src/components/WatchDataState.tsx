import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { WatchSectionState } from "@/watch/data-state";

export function WatchSkeleton({
  label = "Loading this section…",
}: {
  variant?: "cards" | "list" | "detail";
  className?: string;
  label?: string;
}) {
  return (
    <span
      className="sr-only"
      role="status"
      aria-label={label}
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </span>
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

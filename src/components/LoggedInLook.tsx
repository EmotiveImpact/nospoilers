import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { navigate } from "@/nav.ts"

/** Two logged-in looks: trial desk vs unpaid locked scan. */
export function LoggedInLook({ current }: { current: "trial" | "ended" }) {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-lg text-sm leading-relaxed text-mute">
        {current === "trial"
          ? "Preview of the desk while coverage is on. Watch is live. Hosted unpacks run."
          : "Preview after coverage ends. The drop zone stays. We do not unpack until you subscribe."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={current === "trial" ? "default" : "outline"}
          className={cn(current === "trial" && "pointer-events-none")}
          onClick={() => navigate("/watch?as=trial")}
        >
          Trial desk
        </Button>
        <Button
          type="button"
          size="sm"
          variant={current === "ended" ? "default" : "outline"}
          className={cn(current === "ended" && "pointer-events-none")}
          onClick={() => navigate("/scan?as=ended")}
        >
          Unpaid scan
        </Button>
      </div>
    </div>
  )
}

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { navigate } from "@/nav.ts"

/** Two logged-in looks from the old mockups: trial desk vs unpaid locked scan. */
export function LoggedInLook({ current }: { current: "trial" | "ended" }) {
  return (
    <div className="mb-10 flex flex-col gap-4 border-b border-white/5 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <p className="max-w-lg text-sm leading-relaxed text-mute">
        {current === "trial"
          ? "This is logged in while the trial (or a paid plan) is on. Watch is live. Hosted unpacks run."
          : "This is logged in after coverage ends unpaid. The drop zone stays so you remember the door. We do not unpack until you subscribe."}
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

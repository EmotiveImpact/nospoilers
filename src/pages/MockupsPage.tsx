import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"

export function MockupsPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Moved into the product</p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl tracking-tight text-snow md:text-5xl">
        Those screens are Watch and Scan now.
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-mute">
        The interesting mockups were the two logged-in states. Trial (or paid) is the watch desk.
        Unpaid is the locked scan. They live on the real routes.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => navigate("/watch?as=trial")}>
          Trial desk
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => navigate("/scan?as=ended")}>
          Unpaid locked scan
        </Button>
      </div>
    </main>
  )
}

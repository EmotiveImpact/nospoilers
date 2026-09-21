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
        Watch now requires a real signed-in workspace. Scan remains available locally without a
        sample tenant or query-string billing simulation.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" onClick={() => navigate("/watch")}>
          Open Watch
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={() => navigate("/scan")}>
          Open Scan
        </Button>
      </div>
      {import.meta.env.DEV && <>
      <p className="mt-16 text-[11px] uppercase tracking-[0.28em] text-dim">Review comps</p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-mute">
        Static HTML for shell and page studies. They are not the live desk.
      </p>
      <p className="mt-4">
        <a href="/mockup-review/index.html" className="text-snow underline underline-offset-4">
          All mockups
        </a>
      </p>
      </>}
    </main>
  )
}

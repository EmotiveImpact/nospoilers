import { PageHeader } from "@/components/PageHeader.tsx"
import { Button } from "@/components/ui/button"
import { navigate } from "@/nav.ts"

export function MockupsPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <PageHeader
        kicker="Moved into the product"
        title="Those screens are Watch and Scan now."
        description="The interesting mockups were the two logged-in states. Trial (or paid) is the watch desk. Unpaid is the locked scan. They live on the real routes."
        actions={
          <>
            <Button type="button" size="lg" onClick={() => navigate("/watch?as=trial")}>
              Trial desk
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => navigate("/scan?as=ended")}>
              Unpaid locked scan
            </Button>
          </>
        }
      />
    </main>
  )
}

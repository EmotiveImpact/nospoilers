import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react"

const SCREENS = [
  {
    id: "landing",
    label: "Landing",
    src: "/mockups/landing.html",
    blurb: "Sells the GitHub App. Price on screen one.",
  },
  {
    id: "desk",
    label: "Watch · trial",
    src: "/mockups/desk.html",
    blurb: "Logged in, 11 days left. Alerts on.",
  },
  {
    id: "paywall",
    label: "Scan · locked",
    src: "/mockups/scan-paywall.html",
    blurb: "Coverage ended. Drop zone still there, unpacks off.",
  },
  {
    id: "pricing",
    label: "Pricing",
    src: "/mockups/pricing.html",
    blurb: "Solo $29 · Team $99. Coverage, not credits.",
  },
] as const

export function MockupsPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">Not the live product</p>
      <h1 className="mt-4 font-display text-4xl tracking-tight text-snow md:text-5xl">Mockups</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-mute">
        Four screens for the paid model: trial, then subscribe, or we stop unpacking on our servers.
        These do not bill and do not scan.
      </p>
      <TabGroup className="mt-10">
        <TabList className="flex flex-wrap gap-1 rounded-full bg-white/[0.06] p-1 w-fit">
          {SCREENS.map((screen) => (
            <Tab
              key={screen.id}
              className="rounded-full px-3.5 py-1.5 text-sm text-dim outline-none data-hover:text-snow data-selected:bg-snow data-selected:text-ink"
            >
              {screen.label}
            </Tab>
          ))}
        </TabList>
        <TabPanels className="mt-6">
          {SCREENS.map((screen) => (
            <TabPanel key={screen.id} className="outline-none">
              <p className="mb-3 text-sm text-dim">{screen.blurb}</p>
              <iframe
                title={screen.label}
                src={screen.src}
                className="h-[min(78vh,52rem)] w-full border border-white/10 bg-ink"
              />
            </TabPanel>
          ))}
        </TabPanels>
      </TabGroup>
    </main>
  )
}

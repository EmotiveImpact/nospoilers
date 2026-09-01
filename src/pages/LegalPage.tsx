import { LEGAL_NAV, LEGAL_PAGES, LEGAL_EFFECTIVE, type LegalSlug } from "@/legal.ts"
import { navigate } from "@/nav.ts"
import { type MouseEvent } from "react"

function go(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  navigate(href)
}

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const page = LEGAL_PAGES[slug]

  return (
    <main className="fade-up mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">{page.kicker}</p>
      <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        {page.title}
      </h1>
      <p className="mt-4 text-sm text-dim">Effective {LEGAL_EFFECTIVE}.</p>
      <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Legal">
        {LEGAL_NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={(event) => go(event, item.href)}
            className={item.slug === slug ? "text-snow" : "text-mute hover:text-snow"}
          >
            {item.label}
          </a>
        ))}
      </nav>
      {page.sections.map((section) => (
        <section key={section.heading} className="mt-12">
          <h2 className="font-display text-xl tracking-tight text-snow">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-relaxed text-mute">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}

import { DOCS_KICKER, DOCS_SECTIONS, DOCS_TITLE } from "@/docs.ts"
import { LEGAL_NAV } from "@/legal.ts"
import { navigate } from "@/nav.ts"
import { type MouseEvent } from "react"

function go(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  navigate(href)
}

export function DocsPage() {
  return (
    <main className="fade-up mx-auto max-w-3xl px-5 py-16 md:py-24">
      <p className="text-[11px] uppercase tracking-[0.28em] text-dim">{DOCS_KICKER}</p>
      <h1 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-snow md:text-6xl">
        {DOCS_TITLE}
      </h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-mute">
        Packed bytes and GitHub visibility. No scan credits. No execution of your packages.
      </p>
      {DOCS_SECTIONS.map((section) => (
        <section key={section.heading} className="mt-12">
          <h2 className="font-display text-xl tracking-tight text-snow">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-relaxed text-mute">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <nav className="mt-16 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Legal">
        {LEGAL_NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            onClick={(event) => go(event, item.href)}
            className="text-mute hover:text-snow"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </main>
  )
}

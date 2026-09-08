import { LEGAL_NAV, LEGAL_PAGES, type LegalSlug } from '@/legal.ts';
import { PUBLIC_LINKS } from '@/website/page-paths.ts';
import '@/website/website.css';

/** Existing public policy material remains a review draft; no legal terms are enacted here. */
export function LegalPage({ slug }: { slug: LegalSlug }) {
  const page = LEGAL_PAGES[slug];
  return <div className="nsw">
    <a className="nsw-skip" href="#nsw-main">Skip to policy information</a>
    <nav className="nsw-public-nav" aria-label="Explore NoSpoilers">{PUBLIC_LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
    <main id="nsw-main" className="nsw-public-main">
      <header className="nsw-public-hero"><p className="nsw-eyebrow">Policy material · Review draft</p><h1 className="nsw-title">{page.title}</h1><p className="nsw-lede">This material has not been confirmed as approved terms for the completed service.</p></header>
      <div className="nsw-prose">
        <aside className="nsw-note nsw-warning" aria-label="Legal review required"><strong>Draft for review, not an approved commitment</strong><p>The retained text below may contain historical descriptions that no longer match implementation. It must receive product, operational and appropriate legal review before publication as effective policy. No effective date, certification, service guarantee or universal deletion commitment is established by this page.</p></aside>
        <p>For the current implementation boundaries, read <a href="/security">Security and trust</a>, <a href="/docs/retention-and-deletion">retention and deletion requests</a> and <a href="/pricing">the pricing explanation</a>. Contact details are on <a href="/support">Support</a>.</p>
        <nav className="nsw-public-nav" aria-label="Policy documents">{LEGAL_NAV.map(item => <a key={item.href} href={item.href} aria-current={item.slug === slug ? 'page' : undefined}>{item.label}</a>)}</nav>
        <details className="nsw-legal-draft"><summary>Read the retained draft for review</summary>
          {page.sections.map((section, index) => <section className="nsw-section" key={section.heading} aria-labelledby={`draft-section-${index}`}><h2 id={`draft-section-${index}`}>{section.heading}</h2>{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</section>)}
        </details>
      </div>
    </main>
  </div>;
}

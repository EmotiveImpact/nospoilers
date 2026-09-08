import { renderHeroVisual } from './hero-visuals.ts';
import { DOC_ARTICLES, findArticle } from './docs-content.ts';
import { DOC_GROUPS, PUBLIC_LINKS, articlePath, cleanPath } from './page-paths.ts';
import { findWebsitePage } from './site-content.ts';
import type { Article, Block, Inline, Section } from './model.ts';
import type { SearchResult } from './search.ts';

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
export function safeHref(value: string): string {
  if (/^(?:\/(?!\/)|#[a-zA-Z0-9_-])/.test(value) && !/[\\\u0000-\u0020]/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    if (url.protocol === 'mailto:' && !/[\r\n]/.test(value)) return value;
  } catch { /* Invalid content links never become executable destinations. */ }
  return '#nsw-main';
}
const href = (value: string) => escapeHtml(safeHref(value));
function icon(kind: 'arrow' | 'search' | 'book' | 'menu' | 'close' | 'copy' | 'file' = 'arrow'): string {
  const paths = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    book: '<path d="M4 4h7l1 2 1-2h7v15h-7l-1 2-1-2H4V4Zm8 2v15"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    file: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h4"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}
function inlines(parts: Inline[]): string {
  return parts.map(part => typeof part === 'string' ? escapeHtml(part) : 'code' in part
    ? `<code>${escapeHtml(part.code)}</code>` : `<a href="${href(part.href)}">${escapeHtml(part.text)}</a>`).join('');
}
function highlightedCode(value: string, language: string): string {
  // Small, escaped presentation only. No HTML/Markdown execution or remote highlighter.
  return value.split('\n').map(line => {
    if (/^\s*#/.test(line)) return `<span class="nsw-code-comment">${escapeHtml(line)}</span>`;
    if (language === 'yaml') {
      const match = line.match(/^(\s*(?:- )?)([A-Za-z_][\w-]*)(:)(.*)$/);
      if (match) return `${escapeHtml(match[1])}<span class="nsw-code-key">${escapeHtml(match[2])}</span>:${escapeHtml(match[4])}`;
    }
    return escapeHtml(line);
  }).join('\n');
}
export function renderBlock(block: Block, id: string, review = false): string {
  switch (block.type) {
    case 'paragraph': return `<p>${inlines(block.text)}</p>`;
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag}>${block.items.map(item => `<li>${inlines(item)}</li>`).join('')}</${tag}>`;
    }
    case 'note': return `<aside class="nsw-note ${block.tone === 'warning' ? 'nsw-warning' : ''}" aria-label="${escapeHtml(block.title)}"><strong>${block.tone === 'warning' ? 'Important: ' : ''}${escapeHtml(block.title)}</strong><p>${inlines(block.text)}</p></aside>`;
    case 'code': return `<figure class="nsw-code"><figcaption><span>${escapeHtml(block.label)}</span><button type="button" data-nsw-copy="${escapeHtml(id)}" aria-label="Copy ${escapeHtml(block.label)}">${icon('copy')}<span>Copy</span></button></figcaption><pre tabindex="0" aria-label="${escapeHtml(block.label)}"><code id="${escapeHtml(id)}" data-language="${escapeHtml(block.language)}">${highlightedCode(block.value, block.language)}</code></pre><p class="nsw-copy-status" role="status" aria-live="polite"></p></figure>`;
    case 'table': return `<div class="nsw-table-scroll" role="region" aria-label="Reference table" tabindex="0"><table><thead><tr>${block.columns.map(column => `<th scope="col">${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    case 'capture': return review ? `<div data-nsw-capture="${escapeHtml(block.id)}"></div>` : '';
  }
}
function sectionsMarkup(sections: Section[], scope: string, review: boolean): string {
  return sections.map(section => `<section class="nsw-section" aria-labelledby="${escapeHtml(section.id)}"><h2 id="${escapeHtml(section.id)}" tabindex="-1"><a class="nsw-heading-link" href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}<span aria-hidden="true">#</span></a></h2>${section.blocks.map((block, index) => renderBlock(block, `${scope}-${section.id}-${index}`, review)).join('')}</section>`).join('');
}
function publicNav(path: string): string {
  return `<nav class="nsw-public-nav" aria-label="Explore NoSpoilers">${PUBLIC_LINKS.map(([url, title]) => `<a href="${url}"${cleanPath(path) === url ? ' aria-current="page"' : ''}>${title}</a>`).join('')}</nav>`;
}
function sideNavigation(active: string | undefined): string {
  return DOC_GROUPS.map((group,index) => {
    const articles = DOC_ARTICLES.filter(article => article.group === group);
    const expanded = articles.some(article => article.slug === active) || !active && index === 0;
    return `<details class="nsw-nav-group"${expanded ? ' open' : ''}><summary>${escapeHtml(group)}<span aria-hidden="true">⌄</span></summary><ul>${articles.map(article => `<li><a href="${articlePath(article.slug)}"${active === article.slug ? ' aria-current="page"' : ''}>${icon('file')}<span>${escapeHtml(article.title)}</span></a></li>`).join('')}</ul></details>`;
  }).join('');
}
function toc(article: Article): string {
  return `<nav aria-label="On this page"><p class="nsw-nav-label">On this page</p><ol>${article.sections.map(section => `<li><a data-nsw-toc href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a></li>`).join('')}</ol></nav>`;
}
function searchDialog(): string {
  return `<dialog class="nsw-search-dialog" id="nsw-search-dialog" aria-labelledby="nsw-search-title"><div class="nsw-dialog-top"><h2 id="nsw-search-title">Search documentation</h2><button type="button" class="nsw-icon-button" data-nsw-close aria-label="Close documentation search">${icon('close')}</button></div><form role="search" data-nsw-search-form><label class="nsw-sr-only" for="nsw-search-input">Search documentation</label><div class="nsw-search-field">${icon('search')}<input id="nsw-search-input" type="search" maxlength="200" autocomplete="off" spellcheck="false" placeholder="Search topics, actions or errors…" aria-describedby="nsw-search-help"><button type="button" data-nsw-clear>Clear</button></div></form><p class="nsw-search-help" id="nsw-search-help">Searches these guides only. Arrow keys move through results. Escape closes search.</p><p role="status" class="nsw-result-count" data-nsw-search-status aria-live="polite">Type a word or phrase to search.</p><div data-nsw-results class="nsw-search-results"></div><div class="nsw-dialog-foot"><span>Local search · no external search service</span><kbd>Esc</kbd></div></dialog>`;
}
function docsHeader(_path: string, active: string | undefined): string {
  const article = DOC_ARTICLES.find(item => item.slug === active);
  return `<a class="nsw-skip" href="#nsw-main">Skip to documentation</a><header class="nsw-reader-header"><div class="nsw-reader-brand"><a href="/" aria-label="NoSpoilers home"><span class="nsw-brand-mark" aria-hidden="true">[ ]</span></a><a href="/docs">Docs</a><button class="nsw-icon-button" data-nsw-open-search aria-label="Search docs">${icon('search')}</button></div><div class="nsw-reader-context"><span>${escapeHtml(article?.title ?? 'Home')}</span><a class="nsw-reader-app" href="/watch">Open app ${icon()}</a><button class="nsw-icon-button nsw-mobile-toggle" data-nsw-open-menu aria-label="Open documentation navigation" aria-haspopup="dialog" aria-controls="nsw-nav-dialog">${icon('menu')}</button></div></header><dialog class="nsw-nav-dialog" id="nsw-nav-dialog" aria-labelledby="nsw-nav-title"><div class="nsw-dialog-top"><h2 id="nsw-nav-title" class="nsw-sr-only">Documentation navigation</h2><button class="nsw-menu-search" data-nsw-open-search>${icon('search')}<span>Search documentation…</span></button><button class="nsw-icon-button" type="button" data-nsw-close aria-label="Close documentation navigation">${icon('close')}</button></div><nav aria-label="Mobile documentation">${sideNavigation(active)}</nav></dialog>${searchDialog()}`;
}
function guideCard(slug: string, label: string, description: string, symbol: 'book' | 'file' | 'arrow' | 'copy'): string {
  return `<a class="nsw-guide-card" href="${articlePath(slug)}"><div class="nsw-guide-art">${icon(symbol)}</div><div class="nsw-guide-copy"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(description)}</p></div></a>`;
}
function docsHome(): string {
  return `<main class="nsw-docs-main nsw-docs-home" id="nsw-main" tabindex="-1"><header class="nsw-article-header"><h1 class="nsw-title" tabindex="-1">NoSpoilers Docs</h1><p class="nsw-lede">Get started, connect your release sources, and understand the evidence.</p></header><section class="nsw-guide-section" aria-labelledby="nsw-popular"><h2 id="nsw-popular">Get started</h2><div class="nsw-guide-grid">${guideCard('getting-started','Your first scan','From a release package to a saved, private result.','book')}${guideCard('github','Connect GitHub','Choose repositories and connect them to your workspace.','copy')}${guideCard('artifact-scanning','Scan a package','Inspect the actual files that ship to your customers.','file')}${guideCard('website-scanning','Verify a website','Check your production assets and public source maps.','arrow')}</div></section><section class="nsw-guide-section" aria-labelledby="nsw-basics"><h2 id="nsw-basics">Review and respond</h2><div class="nsw-guide-grid">${guideCard('coverage-and-releases','Coverage & releases','Understand connected sources and individual scan attempts.','copy')}${guideCard('release-results','Read your results','Understand findings, policy decisions and scan limits.','file')}${guideCard('alerts','Manage alerts','Assign the response and keep its history together.','arrow')}${guideCard('proof','Share release proof','Preview, share and verify a scoped record of a check.','book')}</div></section><section class="nsw-guide-section" aria-labelledby="nsw-manage"><h2 id="nsw-manage">Manage your workspace</h2><div class="nsw-guide-grid">${guideCard('workspaces-and-roles','Workspaces & roles','Organise your team and control access.','copy')}${guideCard('api-tokens-and-ci','API & CI','Bring release checks into your build pipeline.','file')}${guideCard('notifications','Notifications','Configure destinations and inspect delivery status.','arrow')}${guideCard('policies-and-exceptions','Policies & exceptions','Set the rules and review bounded exceptions.','book')}</div></section><div class="nsw-help-row"><span>Need a hand?</span><a href="/support">Contact support ${icon()}</a></div></main>`;
}
function articleMarkup(article: Article, review: boolean): string {
  const index = DOC_ARTICLES.findIndex(item => item.slug === article.slug);
  const neighbours = [DOC_ARTICLES[index - 1], DOC_ARTICLES[index + 1]];
  return `<main class="nsw-docs-main nsw-prose" id="nsw-main" tabindex="-1"><nav class="nsw-breadcrumbs" aria-label="Breadcrumb"><a href="/docs">Documentation</a><span aria-hidden="true">/</span><span>${escapeHtml(article.group)}</span><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(article.title)}</span></nav><article><header class="nsw-article-header"><h1 class="nsw-title" tabindex="-1">${escapeHtml(article.title)}</h1><p class="nsw-lede">${escapeHtml(article.description)}</p></header><details class="nsw-mobile-toc"><summary>On this page</summary>${toc(article)}</details>${sectionsMarkup(article.sections, article.slug, review)}</article><nav class="nsw-article-pagination" aria-label="Previous and next article">${neighbours.map((item, i) => item ? `<a href="${articlePath(item.slug)}"><small>${i ? 'Next guide' : 'Previous guide'}</small><strong>${escapeHtml(item.title)}</strong>${icon()}</a>` : '<span></span>').join('')}</nav><div class="nsw-help-row"><span>Something still unclear?</span><a href="/support">Get support ${icon()}</a></div></main>`;
}
function notFound(): string {
  return `<main id="nsw-main" class="nsw-docs-main nsw-prose" tabindex="-1"><header class="nsw-article-header"><p class="nsw-eyebrow">Article unavailable</p><h1 class="nsw-title" tabindex="-1">We couldn’t find that guide.</h1><p class="nsw-lede">The address may be incomplete or the article may have moved. No other article has been substituted for this link.</p></header><button type="button" class="nsw-button" data-nsw-open-search>${icon('search')}Search documentation</button><p><a href="/docs">Return to the documentation home</a> or <a href="/support">contact support</a>.</p></main>`;
}
export function renderDocs(path: string, review = false): string {
  const article = findArticle(path);
  const isHome = cleanPath(path) === '/docs';
  return `${docsHeader(path, article?.slug)}<div class="nsw-docs-layout${!article ? ' nsw-no-toc' : ''}"><aside class="nsw-docs-sidebar"><nav aria-label="Documentation"><a class="nsw-nav-home" href="/docs"${isHome ? ' aria-current="page"' : ''}>Documentation home</a>${sideNavigation(article?.slug)}</nav><a class="nsw-sidebar-help" href="/support">Support ${icon()}</a></aside>${isHome ? docsHome() : article ? articleMarkup(article, review) : notFound()}${article ? `<aside class="nsw-toc">${toc(article)}</aside>` : ''}</div>`;
}
export function renderSearchResults(results: SearchResult[]): string {
  return results.map(result => `<a class="nsw-search-result" data-nsw-result href="${articlePath(result.slug)}#${escapeHtml(result.sectionId)}"><small>${escapeHtml(result.group)}</small><strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.sectionTitle)}</span><p>${escapeHtml(result.excerpt)}</p></a>`).join('');
}
function marketingBlock(block: Block, id: string, review: boolean): string {
  if (block.type !== 'table') return renderBlock(block, id, review);
  return `<div class="nsw-capability-grid">${block.rows.map(row => `<article class="nsw-capability-card"><div class="nsw-capability-icon">${icon('file')}</div><h3>${escapeHtml(row[0])}</h3>${row.slice(1).map((cell,index) => `<p><span class="nsw-sr-only">${escapeHtml(block.columns[index+1] ?? '')}: </span>${escapeHtml(cell)}</p>`).join('')}</article>`).join('')}</div>`;
}
export function renderWebsite(path: string, review = false): string {
  const page = findWebsitePage(path);
  if (!page) return notFound();
  return `<a class="nsw-skip" href="#nsw-main">Skip to content</a><main id="nsw-main" class="nsw-marketing-page nsw-page-${escapeHtml(page.path.slice(1))}" tabindex="-1"><header class="nsw-marketing-hero"><div><p class="nsw-eyebrow">${escapeHtml(page.eyebrow)}</p><h1 class="nsw-title">${escapeHtml(page.title)}</h1><p class="nsw-lede">${escapeHtml(page.description)}</p><div class="nsw-actions"><a class="nsw-button nsw-primary" href="${href(page.primary.href)}">${escapeHtml(page.primary.text)}${icon()}</a><a class="nsw-text-link" href="${href(page.secondary.href)}">${escapeHtml(page.secondary.text)}${icon()}</a></div></div>${renderHeroVisual(path)}</header><div class="nsw-marketing-sections">${page.sections.map((section,index)=>`<section class="nsw-marketing-section" aria-labelledby="${escapeHtml(section.id)}"><div class="nsw-marketing-section-heading"><span class="nsw-section-number">0${index+1}</span><h2 id="${escapeHtml(section.id)}">${escapeHtml(section.title)}</h2></div><div class="nsw-marketing-section-body nsw-prose">${section.blocks.map((block,i)=>marketingBlock(block,page.path.slice(1)+'-'+section.id+'-'+i,review)).join('')}</div></section>`).join('')}</div><section class="nsw-marketing-close"><p class="nsw-eyebrow">From explanation to evidence</p><h2>Start with your next release.</h2><div class="nsw-actions"><a class="nsw-button nsw-primary" href="${href(page.primary.href)}">${escapeHtml(page.primary.text)}${icon()}</a><a class="nsw-text-link" href="/docs">Explore the documentation ${icon()}</a></div></section>${publicNav(path)}</main>`;
}
export function websiteTitle(path: string): string {
  if (cleanPath(path) === '/docs') return 'Documentation | NoSpoilers';
  return `${findArticle(path)?.title ?? findWebsitePage(path)?.title ?? 'Guide unavailable'} | NoSpoilers`;
}

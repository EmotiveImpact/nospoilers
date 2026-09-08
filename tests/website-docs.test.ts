import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { DOC_ARTICLES, DOC_ALIASES, findArticle } from '../src/website/docs-content.ts';
import { DOC_GROUPS, PUBLIC_LINKS, WEBSITE_PATHS, isWebsitePath } from '../src/website/page-paths.ts';
import { WEBSITE_PAGES, WEBSITE_CONTACT } from '../src/website/site-content.ts';
import { CAPTURES } from '../src/website/capture-review.ts';
import { searchDocs } from '../src/website/search.ts';
import { escapeHtml, renderBlock, renderDocs, renderWebsite, safeHref } from '../src/website/render.ts';
import type { Block } from '../src/website/model.ts';

const allPages = [...DOC_ARTICLES.map(article => ({ path: '/docs/' + article.slug, sections: article.sections })), ...WEBSITE_PAGES];
const fragments = (html: string) => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const contentLinks = (block: Block): string[] => {
  const parts = block.type === 'paragraph' || block.type === 'note' ? block.text : block.type === 'list' ? block.items.flat() : [];
  return parts.flatMap(part => typeof part === 'object' && 'href' in part ? [part.href] : []);
};

describe('NoSpoilers public documentation content', () => {
  it('has all fifteen required topics with unique stable article and section identities', () => {
    assert.equal(DOC_ARTICLES.length, 15);
    assert.equal(new Set(DOC_ARTICLES.map(article => article.slug)).size, 15);
    for (const article of DOC_ARTICLES) {
      assert.match(article.slug, /^[a-z0-9-]+$/);
      assert.ok(DOC_GROUPS.some(group => group === article.group));
      assert.ok(article.sections.length >= 3);
      assert.equal(new Set(article.sections.map(section => section.id)).size, article.sections.length);
      for (const section of article.sections) assert.match(section.id, /^[a-z0-9-]+$/);
    }
  });
  it('resolves each article and explicit aliases, including refresh/trailing-slash paths', () => {
    for (const article of DOC_ARTICLES) {
      assert.equal(findArticle('/docs/' + article.slug)?.slug, article.slug);
      assert.equal(findArticle('/docs/' + article.slug + '/')?.slug, article.slug);
    }
    for (const [alias, slug] of Object.entries(DOC_ALIASES)) assert.equal(findArticle('/docs/' + alias)?.slug, slug);
  });
  it('does not substitute another guide for malformed, nested or unknown paths', () => {
    for (const path of ['/docs/unknown', '/docs/%ZZ', '/docs/github/other', '/docs/constructor', '/watch/scan']) {
      assert.equal(findArticle(path), undefined);
    }
    assert.ok(renderDocs('/docs/not-a-guide').includes('We couldn’t find that guide.'));
  });
  it('renders one main, one h1, unique fragment IDs and a selected article', () => {
    for (const article of DOC_ARTICLES) {
      const html = renderDocs('/docs/' + article.slug);
      assert.equal((html.match(/<main\b/g) ?? []).length, 1);
      assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
      assert.equal(new Set(fragments(html)).size, fragments(html).length);
      assert.ok(html.includes(`href="/docs/${article.slug}" aria-current="page"`));
      for (const section of article.sections) assert.ok(html.includes(`href="#${section.id}"`));
    }
  });
  it('links previous and next articles without introducing missing neighbours', () => {
    for (const [index, article] of DOC_ARTICLES.entries()) {
      const html = renderDocs('/docs/' + article.slug).split('aria-label="Previous and next article"')[1]!;
      if (index > 0) assert.ok(html.includes('/docs/' + DOC_ARTICLES[index - 1]!.slug));
      if (index < DOC_ARTICLES.length - 1) assert.ok(html.includes('/docs/' + DOC_ARTICLES[index + 1]!.slug));
      assert.ok(!html.includes('/docs/undefined'));
    }
  });
  it('keeps every authored documentation link and heading target valid', () => {
    for (const page of allPages) for (const section of page.sections) for (const block of section.blocks) {
      for (const value of contentLinks(block)) {
        if (!value.startsWith('/docs/')) continue;
        const [path, hash] = value.split('#');
        const article = findArticle(path!);
        assert.ok(article, `${page.path}: missing ${value}`);
        if (hash) assert.ok(article.sections.some(section => section.id === hash), `Missing fragment ${value}`);
      }
    }
  });
  it('supplies the real non-simulated contact path and all six supporting routes', () => {
    assert.equal(WEBSITE_CONTACT, 'emotiveimpact@gmail.com');
    assert.deepEqual(WEBSITE_PAGES.map(page => page.path), [...WEBSITE_PATHS]);
    for (const page of WEBSITE_PAGES) {
      const html = renderWebsite(page.path);
      assert.ok(html.includes('<h1'));
      assert.ok(!html.includes('<form'));
      assert.ok(isWebsitePath(page.path + '/'));
    }
    assert.ok(renderWebsite('/enterprise').includes('mailto:emotiveimpact@gmail.com'));
  });
  it('does not classify authenticated, scanner, billing or unrelated routes as supporting pages', () => {
    for (const path of ['/', '/watch', '/watch/sources', '/watch/scan', '/scan', '/api/v1/scan', '/api/billing/checkout', '/pricing', '/mockups', '/product/unknown']) assert.equal(isWebsitePath(path), false);
  });
  it('keeps the supporting navigation consistent and its destinations known', () => {
    assert.equal(PUBLIC_LINKS.length, 7);
    for (const [href] of PUBLIC_LINKS) assert.ok(href === '/pricing' || isWebsitePath(href));
    for (const path of ['/docs', ...WEBSITE_PATHS]) {
      const html = path === '/docs' ? renderDocs(path) : renderWebsite(path);
      for (const [href] of PUBLIC_LINKS) assert.ok(html.includes(`href="${href}"`));
    }
  });
});

describe('Local documentation search', () => {
  for (const [query, expected] of [['GitHub', 'github'], ['80 MiB', 'supported-inputs'], ['Idempotency-Key', 'api-tokens-and-ci'], ['HMAC', 'proof'], ['independent approval', 'policies-and-exceptions'], ['disconnect', 'retention-and-deletion'], ['verification', 'website-scanning']] as const) {
    it(`finds ${query} in customer documentation`, () => assert.ok(searchDocs(DOC_ARTICLES, query).some(result => result.slug === expected)));
  }
  it('handles empty, whitespace, punctuation and a genuinely absent term honestly', () => {
    for (const query of ['', '   ', 'unfindablequasarzzzz', '<script>bad()</script>']) assert.deepEqual(searchDocs(DOC_ARTICLES, query), []);
  });
  it('is case-insensitive and bounds query and result size', () => {
    assert.deepEqual(searchDocs(DOC_ARTICLES, 'GITHUB'), searchDocs(DOC_ARTICLES, 'github'));
    assert.ok(searchDocs(DOC_ARTICLES, 'scan').length <= 15);
    assert.deepEqual(searchDocs(DOC_ARTICLES, 'x'.repeat(50000)), []);
  });
  it('returns real article sections, one hit per article and readable excerpts', () => {
    const results = searchDocs(DOC_ARTICLES, 'scan');
    assert.equal(new Set(results.map(result => result.slug)).size, results.length);
    for (const result of results) {
      assert.ok(findArticle('/docs/' + result.slug)?.sections.some(section => section.id === result.sectionId));
      assert.ok(result.excerpt.length <= 187);
    }
  });
});

describe('Safe templates and review-only captures', () => {
  it('escapes text, code and attribute delimiters', () => {
    assert.equal(escapeHtml('<script>"&\'</script>'), '&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
    const html = renderBlock({ type: 'code', language: 'bash', label: 'Demo "<script>"', value: '<img src=x onerror=alert(1)>' }, 'demo');
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;img'));
    assert.ok(html.includes('data-nsw-copy="demo"'));
  });
  it('rejects executable, protocol-relative and backslash destinations', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,bad', '//example.com', '/\\example.com', 'file:///tmp/x']) assert.equal(safeHref(value), '#nsw-main');
    assert.equal(safeHref('/docs/proof#verify'), '/docs/proof#verify');
    assert.equal(safeHref('https://example.com/guide'), 'https://example.com/guide');
  });
  it('never emits capture notes, empty image placeholders or screenshot images by default', () => {
    for (const page of allPages) {
      const html = page.path.startsWith('/docs/') ? renderDocs(page.path) : renderWebsite(page.path);
      assert.ok(!html.includes('data-nsw-capture'));
      assert.ok(!html.includes('CAPTURE-'));
      assert.ok(!html.includes('<img'));
    }
  });
  it('maps every review slot to one documented capture with its precise destination', () => {
    const used: string[] = [];
    for (const page of allPages) for (const section of page.sections) for (const block of section.blocks) {
      if (block.type !== 'capture') continue;
      used.push(block.id);
      const capture = CAPTURES.find(item => item.id === block.id);
      assert.ok(capture, block.id);
      assert.equal(capture.destination, `${page.path}#${section.id}`);
      assert.ok(capture.route.startsWith('/watch/'));
      assert.ok(capture.caption && capture.viewport && capture.demonstrates && capture.state && capture.framing);
      const html = page.path.startsWith('/docs/') ? renderDocs(page.path, true) : renderWebsite(page.path, true);
      assert.ok(html.includes(`data-nsw-capture="${block.id}"`));
    }
    assert.equal(used.length, 12);
    assert.equal(new Set(used).size, used.length);
    assert.equal(CAPTURES.length, used.length);
  });
});

import { blockText, type Article } from "./model.ts";
export type SearchResult = { slug: string; title: string; group: string; sectionId: string; sectionTitle: string; excerpt: string; score: number };
const normalise = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** No remote index, tracking, regular-expression input or customer data. */
export function searchDocs(articles: readonly Article[], rawQuery: string): SearchResult[] {
  const terms = [...new Set(normalise(rawQuery.slice(0, 200)).trim().split(/\s+/).filter(Boolean))];
  if (!terms.length) return [];
  const results: SearchResult[] = [];
  for (const article of articles) {
    const title = normalise(article.title);
    const keywords = normalise(article.keywords.join(" "));
    let best: SearchResult | null = null;
    for (const section of article.sections) {
      const body = section.blocks.map(blockText).join(" ").replace(/\s+/g, " ");
      const heading = normalise(section.title);
      const searchable = normalise(`${article.title} ${article.description} ${keywords} ${section.title} ${body}`);
      if (!terms.every(term => searchable.includes(term))) continue;
      const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 12 : 0) + (heading.includes(term) ? 7 : 0) + (keywords.includes(term) ? 4 : 0) + (normalise(body).includes(term) ? 1 : 0), 0);
      const first = normalise(body).indexOf(terms[0]!);
      const start = Math.max(0, first - 45);
      const excerpt = `${start ? "…" : ""}${body.slice(start, start + 185)}${body.length > start + 185 ? "…" : ""}`;
      const result = { slug: article.slug, title: article.title, group: article.group, sectionId: section.id, sectionTitle: section.title, excerpt, score };
      if (!best || score > best.score) best = result;
    }
    if (best) results.push(best);
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 15);
}

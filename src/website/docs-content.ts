import { START_ARTICLES } from "./docs-start.ts";
import { SCAN_ARTICLES } from "./docs-scan.ts";
import { REVIEW_ARTICLES } from "./docs-review.ts";
import { MANAGE_ARTICLES } from "./docs-manage.ts";
import { cleanPath } from "./page-paths.ts";
export const DOC_ARTICLES = [...START_ARTICLES, ...SCAN_ARTICLES, ...REVIEW_ARTICLES, ...MANAGE_ARTICLES];
export const DOC_ALIASES: Readonly<Record<string, string>> = {
  quickstart: "getting-started", "start-guide": "getting-started", cli: "api-tokens-and-ci",
  api: "api-tokens-and-ci", workspaces: "workspaces-and-roles", scanning: "artifact-scanning",
  websites: "website-scanning", coverage: "coverage-and-releases", releases: "release-results",
  policies: "policies-and-exceptions", receipts: "proof", retention: "retention-and-deletion",
};
export function findArticle(path: string) {
  const parts = cleanPath(path).split("/");
  if (parts.length !== 3 || parts[1] !== "docs") return undefined;
  let slug: string;
  try { slug = decodeURIComponent(parts[2]!); } catch { return undefined; }
  return DOC_ARTICLES.find(article => article.slug === (DOC_ALIASES[slug] ?? slug));
}

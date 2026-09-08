export const WEBSITE_PATHS = ["/product", "/use-cases", "/integrations", "/security", "/enterprise", "/support"] as const;
export type WebsitePath = typeof WEBSITE_PATHS[number];
export function cleanPath(path: string): string { return path.replace(/\/+$/, "") || "/"; }
export function isWebsitePath(path: string): boolean { return WEBSITE_PATHS.some(candidate => candidate === cleanPath(path)); }
export function articlePath(slug: string): string { return `/docs/${slug}`; }
export const DOC_GROUPS = ["Start here", "Connect and scan", "Review and respond", "Manage your workspace"] as const;

export const PUBLIC_LINKS = [
  ['/product', 'Product'], ['/use-cases', 'Use cases'], ['/integrations', 'Integrations'],
  ['/pricing', 'Pricing'], ['/security', 'Security'], ['/enterprise', 'Enterprise'], ['/support', 'Support'],
] as const;

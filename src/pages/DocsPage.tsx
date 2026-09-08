import { lazy, Suspense } from 'react';
import { PublicPageBoundary } from '@/website/PublicPageBoundary.tsx';

const Documentation = lazy(() => import('@/website/PublicContent.tsx').then(module => ({ default: module.PublicContent })));
export function DocsPage({ path = '/docs' }: { path?: string }) {
  return <PublicPageBoundary key={path}><Suspense fallback={<main className="mx-auto max-w-3xl px-5 py-16" role="status">Loading documentation…</main>}>
    <Documentation key={path} path={path} docs />
  </Suspense></PublicPageBoundary>;
}

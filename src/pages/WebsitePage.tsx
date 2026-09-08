import { lazy, Suspense } from 'react';
import { PublicPageBoundary } from '@/website/PublicPageBoundary.tsx';

const Content = lazy(() => import('@/website/PublicContent.tsx').then(module => ({ default: module.PublicContent })));
export function WebsitePage({ path }: { path: string }) {
  return <PublicPageBoundary key={path}><Suspense fallback={<main className="mx-auto max-w-3xl px-5 py-16" role="status">Loading page…</main>}>
    <Content key={path} path={path} />
  </Suspense></PublicPageBoundary>;
}

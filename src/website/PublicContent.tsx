import { useEffect, useMemo, useRef } from 'react';
import { enhanceWebsite } from './controller.ts';
import { renderDocs, renderWebsite, websiteTitle } from './render.ts';
import './website.css';

/** Existing React/Vite route adapter. Native enhancements never touch the app shell. */
export function PublicContent({ path, docs = false }: { path: string; docs?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const review = import.meta.env.DEV && import.meta.env.VITE_WEBSITE_CAPTURE_REVIEW === '1';
  // render.ts escapes content and validates links; arbitrary HTML is not a content block type.
  const html = useMemo(() => docs ? renderDocs(path, review) : renderWebsite(path, review), [path, docs, review]);
  useEffect(() => {
    if (!root.current) return;
    const node = root.current;
    const previousTitle = document.title;
    document.title = websiteTitle(path);
    const cleanup = enhanceWebsite(node);
    let cancelled = false;
    if (import.meta.env.DEV && import.meta.env.VITE_WEBSITE_CAPTURE_REVIEW === '1') {
      void import('./capture-review.ts').then(module => {
        if (!cancelled && node.isConnected) module.annotateCaptures(node);
      });
    }
    return () => { cancelled = true; cleanup(); document.title = previousTitle; };
  }, [path, html]);
  return <div ref={root} className={docs ? 'nsw nsw-docs-shell' : 'nsw'} dangerouslySetInnerHTML={{ __html: html }} />;
}

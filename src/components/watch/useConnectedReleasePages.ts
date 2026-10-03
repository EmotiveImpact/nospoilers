import { useEffect, useRef, useState } from 'react';
import type { PageSize } from '@/watch/pagination';
import type { ReleaseRevision } from '@/watch/types';

type ReleasePage = {
  rows: ReleaseRevision[];
  nextCursor: string | null;
  context: { workspaceName: string; connectionName: string } | null;
};
type ReleaseLoad = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & ReleasePage);
type PageRequest = { sequence: number; cursor: string | null; pageSize: PageSize };

/** Cursor pages never infer the server's total from the initial loaded context. */
export function useConnectedReleasePages({ search, initialRows, hostedDecision }: {
  search: string;
  initialRows?: ReleaseRevision[];
  hostedDecision?: string;
}) {
  const params = new URLSearchParams(search);
  const install = params.get('install');
  const workspace = params.get('workspace');
  const initialBefore = params.get('before');
  const bootstrap = initialRows === undefined || initialBefore !== null;
  const sequence = useRef(0);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<(string | null)[]>([initialBefore]);
  const [request, setRequest] = useState<PageRequest | null>(() => bootstrap ? { sequence: 0, cursor: initialBefore, pageSize: 10 } : null);
  const [load, setLoad] = useState<ReleaseLoad | null>(() => bootstrap ? { status: 'loading' } : null);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    void (async () => {
      try {
        if (!install) throw new Error('Choose a connection.');
        const query = new URLSearchParams({ installationId: install });
        if (hostedDecision) query.set('hostedDecision', hostedDecision);
        if (workspace) query.set('workspace', workspace);
        query.set('pageSize', String(request.pageSize));
        if (request.cursor) query.set('before', request.cursor);
        const response = await fetch(`/api/releases?${query}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.releases)) throw new Error('Releases unavailable.');
        if (!controller.signal.aborted) setLoad({
          status: 'ready', rows: body.releases,
          nextCursor: typeof body.nextCursor === 'string' ? body.nextCursor : null,
          context: body.context ?? null,
        });
      } catch {
        if (!controller.signal.aborted) setLoad({ status: 'error' });
      }
    })();
    return () => controller.abort();
  }, [hostedDecision, install, request, workspace]);

  const rows = load?.status === 'ready' ? load.rows : load ? [] : (initialRows ?? []).slice(0, 10);
  const nextCursor = load?.status === 'ready' ? load.nextCursor : load ? null : (initialRows?.length ?? 0) > 10 ? String(rows.at(-1)!.id) : null;
  const busy = load?.status === 'loading';
  const error = load?.status === 'error';
  const loadPage = (nextPage: number, cursor: string | null, size: PageSize, nextCursors: (string | null)[]) => {
    setPage(nextPage);
    setPageSize(size);
    setCursors(nextCursors);
    setLoad({ status: 'loading' });
    setRequest({ sequence: ++sequence.current, cursor, pageSize: size });
  };
  return {
    rows, page, pageSize, busy, error,
    context: load?.status === 'ready' ? load.context : null,
    hasNext: nextCursor !== null,
    hasPrevious: page > 0,
    showPagination: (initialRows?.length ?? 0) > 10 || page > 0 || nextCursor !== null || pageSize !== 10,
    onNext: () => {
      if (!nextCursor || busy || error) return;
      const nextCursors = [...cursors.slice(0, page + 1), nextCursor];
      loadPage(page + 1, nextCursor, pageSize, nextCursors);
    },
    onPrevious: () => {
      if (page === 0 || busy || error) return;
      loadPage(page - 1, cursors[page - 1], pageSize, cursors);
    },
    onPageSizeChange: (size: PageSize) => {
      if (busy || error) return;
      loadPage(0, null, size, [null]);
    },
    retry: () => loadPage(page, cursors[page] ?? null, pageSize, cursors),
  };
}

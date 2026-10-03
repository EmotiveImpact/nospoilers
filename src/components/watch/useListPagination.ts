import { useState } from 'react';
import type { PageSize } from '@/watch/pagination';

/** Page state belongs to its current filter/scope, while the chosen size stays local. */
export function useListPagination(total: number, scopeKey: string) {
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [position, setPosition] = useState({ scopeKey, page: 0 });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(position.scopeKey === scopeKey ? position.page : 0, pageCount - 1);
  if (position.scopeKey !== scopeKey || position.page !== page) {
    setPosition({ scopeKey, page });
  }
  return {
    page, pageSize, pageCount, offset: page * pageSize,
    onPageChange: (next: number) => setPosition({ scopeKey, page: Math.max(0, Math.min(pageCount - 1, next)) }),
    onPageSizeChange: (next: PageSize) => {
      setPageSize(next);
      setPosition({ scopeKey, page: 0 });
    },
  };
}

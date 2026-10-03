import { AppSelect } from '@/components/ui/app-select';
import { Button } from '@/components/ui/button';
import { PAGE_SIZES, type PageSize } from '@/watch/pagination';
import './design/list-pagination.css';

export function ListPagination({ label, pageSize, onPageSizeChange, page, count, total, hasPrevious, hasNext, onPrevious, onNext, disabled = false }: {
  label: string;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  page: number;
  count: number;
  total?: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  disabled?: boolean;
}) {
  const countLabel = (count === 1 ? label.replace(/ies$/i, 'y').replace(/s$/i, '') : label).toLowerCase();
  const range = total === undefined
    ? `Page ${page + 1} · ${count} ${countLabel}`
    : count ? `${page * pageSize + 1}–${page * pageSize + count} of ${total} ${label.toLowerCase()}` : `0 ${label.toLowerCase()}`;
  return <nav className="watch-list-pagination" aria-label={`${label} pagination`}>
    <p className="watch-pagination-count" aria-live="polite">{range}</p>
    <div className="watch-pagination-size"><span aria-hidden>Per page</span><AppSelect label={`${label} per page`} value={pageSize} disabled={disabled} onValueChange={value => onPageSizeChange(Number(value) as PageSize)}>
      {PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
    </AppSelect></div>
    <div className="watch-pagination-actions"><Button type="button" size="sm" variant="outline" disabled={disabled || !hasPrevious} onClick={onPrevious}>Previous</Button><Button type="button" size="sm" variant="outline" disabled={disabled || !hasNext} onClick={onNext}>Next</Button></div>
  </nav>;
}

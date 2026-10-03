export const PAGE_SIZES = [10, 30, 60] as const;
export type PageSize = typeof PAGE_SIZES[number];

export function parsePageSize(value: unknown, fallback = 10): number {
  const size = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return PAGE_SIZES.some(option => option === size) ? size : fallback;
}

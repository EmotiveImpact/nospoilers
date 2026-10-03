// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WatchSourcesSummary } from '../src/components/WatchSourcesSummary';
import { buildSourceViewModels } from '../src/watch/view-models';
import { radixUiTestSupport } from './helpers/radix-ui';
import { selectOption } from './helpers/select-option';

vi.mock('../src/nav', () => ({ navigate: vi.fn() }));
radixUiTestSupport();
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function sources(count: number) {
  return buildSourceViewModels({
    repos: Array.from({ length: count }, (_, index) => ({ id: index + 1, full_name: `org/repo-${String(index + 1).padStart(2, '0')}`, private: true, last_checked_at: null })),
    origins: [], maps: [], packages: [],
  });
}
const props = {
  mode: 'sources' as const,
  search: '?workspace=one&install=7',
  setup: { done: 0, total: 5, steps: [], next: null },
  state: { status: 'ready' as const },
  onRetry: () => undefined,
};
const dataRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

it('paginates source rows at 10, 30 and 60, and clamps the last page when sources are removed', async () => {
  const view = render(<WatchSourcesSummary {...props} sources={sources(65)} />);
  expect(dataRows()).toHaveLength(10);
  expect(screen.queryByText('org/repo-11')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  expect(screen.getByText('org/repo-11')).toBeTruthy();
  expect(screen.queryByText('org/repo-01')).toBeNull();

  await selectOption(screen.getByRole('combobox'), '30');
  expect(dataRows()).toHaveLength(30);
  expect(screen.getByText('org/repo-01')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  expect(screen.getByText('org/repo-31')).toBeTruthy();
  await selectOption(screen.getByRole('combobox'), '60');
  expect(dataRows()).toHaveLength(60);
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  expect(dataRows()).toHaveLength(5);
  expect(screen.getByText('org/repo-65')).toBeTruthy();

  view.rerender(<WatchSourcesSummary {...props} sources={sources(35)} />);
  expect(dataRows()).toHaveLength(35);
  expect(screen.getByText('org/repo-01')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Next/ })).toHaveProperty('disabled', true);
});

it('searches the full scoped inventory before slicing and resets page on query, filter and workspace changes', () => {
  const inventory = sources(25);
  const view = render(<WatchSourcesSummary {...props} sources={inventory} />);
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search coverage sources' }), { target: { value: 'repo-24' } });
  expect(dataRows()).toHaveLength(1);
  expect(screen.getByText('org/repo-24')).toBeTruthy();
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByRole('tab', { name: 'GitHub 25' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear source search' }));
  expect(screen.getByText('org/repo-01')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  view.rerender(<WatchSourcesSummary {...props} filter="github" sources={inventory} />);
  expect(screen.getByText('org/repo-01')).toBeTruthy();
  view.rerender(<WatchSourcesSummary {...props} sources={inventory} />);
  expect(screen.getByText('org/repo-01')).toBeTruthy();
  view.rerender(<WatchSourcesSummary {...props} filter="github" sources={inventory} />);
  fireEvent.click(screen.getByRole('button', { name: /Next/ }));
  view.rerender(<WatchSourcesSummary {...props} filter="github" search="?workspace=two&install=7" sources={inventory} />);
  expect(screen.getByText('org/repo-01')).toBeTruthy();
  expect(screen.queryByText('org/repo-11')).toBeNull();
});

it('retains exact source details outside the displayed page and avoids pagination for ten sources', () => {
  const view = render(<WatchSourcesSummary {...props} sources={sources(25)} selectedSourceKey="repo-25" />);
  expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Open repository' }).getAttribute('href')).toBe('https://github.com/org/repo-25');
  view.rerender(<WatchSourcesSummary {...props} sources={sources(10)} />);
  expect(dataRows()).toHaveLength(10);
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByRole('button', { name: /Next/ })).toBeNull();
});

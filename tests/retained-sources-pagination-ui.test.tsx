// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RetainedSources } from '../src/components/watch/RetainedSources';
import { radixUiTestSupport } from './helpers/radix-ui';
import { selectOption } from './helpers/select-option';

radixUiTestSupport();
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const rows = (count: number, prefix = 'retained') => Array.from({ length: count }, (_, index) => ({ id: index + 1, kind: 'npm' as const, name: `${prefix}-${index + 1}`, disconnectedAt: '2026-09-16T10:00:00Z' }));
const response = (count: number, prefix?: string) => ({ ok: true, json: async () => ({ sources: rows(count, prefix) }) });

it('paginates the returned disconnected source inventory and preserves reconnection scope', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(65)));
  render(<RetainedSources installationId={7} search="?workspace=one&install=7" />);
  await screen.findByText('retained-1');
  const sourceList = screen.getByRole('region', { name: 'Disconnected sources' });
  expect(within(sourceList).getAllByRole('listitem')).toHaveLength(10);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('retained-11')).toBeTruthy();
  await selectOption(screen.getByRole('combobox', { name: 'Disconnected sources per page' }), '30');
  expect(within(sourceList).getAllByRole('listitem')).toHaveLength(30);
  expect(screen.getByText('retained-1')).toBeTruthy();
  await selectOption(screen.getByRole('combobox', { name: 'Disconnected sources per page' }), '60');
  expect(within(sourceList).getAllByRole('listitem')).toHaveLength(60);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(within(sourceList).getAllByRole('listitem')).toHaveLength(5);
  const target = new URL(screen.getAllByRole('link', { name: 'Reconnect package' })[0].getAttribute('href')!, 'https://nospoilers.dev');
  expect(target.pathname).toBe('/watch/sources');
  expect(target.searchParams.get('workspace')).toBe('one');
  expect(target.searchParams.get('install')).toBe('7');
  expect(target.searchParams.get('configure')).toBe('npm');
});

it('clamps refreshed rows and hides the prior installation while a new inventory loads', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(25)).mockResolvedValueOnce(response(11)).mockResolvedValueOnce(response(2, 'next-install'));
  vi.stubGlobal('fetch', fetch);
  const view = render(<RetainedSources installationId={7} search="?workspace=one&install=7" refreshKey="first" />);
  await screen.findByText('retained-1');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByText('retained-21')).toBeTruthy();
  view.rerender(<RetainedSources installationId={7} search="?workspace=one&install=7" refreshKey="updated" />);
  await screen.findByText('retained-11');
  expect(screen.queryByText('retained-21')).toBeNull();
  expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
  view.rerender(<RetainedSources installationId={8} search="?workspace=two&install=8" refreshKey="updated" />);
  expect(screen.queryByText('retained-11')).toBeNull();
  await screen.findByText('next-install-1');
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(fetch.mock.calls[2][0]).toBe('/api/sources/disconnected?installationId=8');
});

it('hides saved rows and pagination after a failed refresh', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(25)).mockResolvedValueOnce({ ok: false });
  vi.stubGlobal('fetch', fetch);
  const view = render(<RetainedSources installationId={7} search="?workspace=one&install=7" refreshKey="first" />);
  await screen.findByText('retained-1');
  view.rerender(<RetainedSources installationId={7} search="?workspace=one&install=7" refreshKey="failed" />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveProperty('textContent', 'Disconnected sources could not be loaded.'));
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.queryByText('retained-1')).toBeNull();
});

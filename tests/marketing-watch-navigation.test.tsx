// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { V20Homepage } from '../src/components/marketing/V20Homepage';
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [key, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
  window.history.replaceState({}, '', '/');
});

// Isolated API fixtures, never a hosted/customer session or provider acceptance claim.
function session(member: boolean) {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url === '/api/me') return Response.json({ user: member ? { login: 'test-member' } : null, githubApp: true, emailAuth: false, installations: [] });
    if (member && url === '/api/workspaces') return Response.json({ workspaces: [{ id: 'test-workspace', name: 'Test workspace', role: 'owner', installation_id: null, archived_at: null, trial_ends_at: '2099-01-01T00:00:00Z', plan: null }] });
    if (member && url === '/api/workspaces/test-workspace/overview') return Response.json({ workspace: { name: 'Test workspace', archived: false }, counts: { total: 0, active: 0, attention: 0, passed: 0 }, recent: [] });
    return Response.json({ error: 'No fixture for this request' }, { status: 503 });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

for (const path of ['/', '/product']) for (const member of [false, true]) for (const mobile of [false, true]) {
  it(`${path}: ${mobile ? 'mobile menu' : 'header'} opens Watch for a ${member ? 'member' : 'visitor'}`, async () => {
    const fetcher = session(member);
    window.history.replaceState({}, '', path);
    render(<App />);
    const label = member ? 'Back to workspace' : 'Log in';
    await screen.findByRole('button', { name: label });
    if (mobile) {
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Site navigation' })).getByRole('button', { name: label }));
    } else fireEvent.click(screen.getByRole('button', { name: label }));
    expect(window.location.pathname).toBe('/watch');
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(screen.queryByRole('dialog', { name: 'Site navigation' })).toBeNull();
    if (member) {
      await waitFor(() => expect(new URLSearchParams(window.location.search).get('workspace')).toBe('test-workspace'));
      expect(await screen.findByRole('heading', { name: 'Your first release starts here.' })).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Sign in with GitHub' })).toBeNull();
    } else {
      expect(await screen.findByRole('heading', { name: 'Sign in and get to work.' }, { timeout: 10000 })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Sign in with GitHub' }).getAttribute('href')).toBe('/api/auth/github');
      expect(screen.queryByLabelText('Email', { exact: true })).toBeNull();
      expect(fetcher.mock.calls.every(([url]) => url === '/api/me')).toBe(true);
      fireEvent.click(screen.getAllByRole('link', { name: 'Back to product' })[0]);
      expect(window.location.pathname).toBe('/');
      expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
    }
  });
}

it.each([false, true])('keeps every homepage scan CTA consistent for member=%s', async member => {
  session(member);
  render(<V20Homepage />);
  await screen.findByRole('button', { name: member ? 'Back to workspace' : 'Log in' });
  const destination = member ? '/watch/scan' : '/scan';
  const footer = screen.getByRole('link', { name: 'Start a scan' });
  expect(footer.getAttribute('href')).toBe(destination);
  expect(screen.queryByRole('link', { name: 'New scan' })).toBeNull();
  fireEvent.click(footer);
  expect(window.location.pathname).toBe(destination);
  fireEvent.click(screen.getByRole('button', { name: 'Start a scan' }));
  expect(window.location.pathname).toBe(destination);
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Site navigation' })).getByRole('button', { name: 'Start a scan' }));
  expect(window.location.pathname).toBe(destination);
  expect(document.querySelector('dialog.v20-mobile-menu')?.hasAttribute('open')).toBe(false);
  expect(document.body.style.overflow).not.toBe('hidden');
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.homepage-d button.start')].filter(button => !button.textContent?.includes('trial')); // Pricing plan actions retain their existing trial labels.
  expect(buttons.length).toBeGreaterThan(1);
  for (const button of buttons) {
    expect(button.textContent).toMatch(/^Start a scan/);
    fireEvent.click(button);
    expect(window.location.pathname).toBe(destination);
    window.history.replaceState({}, '', '/');
    fireEvent(window, new PopStateEvent('popstate'));
    await screen.findByRole('button', { name: member ? 'Back to workspace' : 'Log in' });
  }
});

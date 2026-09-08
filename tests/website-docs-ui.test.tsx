// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicContent } from '../src/website/PublicContent.tsx';

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
function restore(object: object, key: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(object, key, descriptor);
  else Reflect.deleteProperty(object, key);
}
beforeEach(() => {
  // jsdom dialog/clipboard adapters test controller contracts, not browser permission or inert rendering.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); } });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  restore(HTMLDialogElement.prototype, 'showModal', originalShow);
  restore(HTMLDialogElement.prototype, 'close', originalClose);
  restore(navigator, 'clipboard', originalClipboard);
});

describe('Public documentation React adapter', () => {
  it('mounts the actual article and runs local search without an API request', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(createElement(PublicContent, { path: '/docs/proof', docs: true }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('proof');
    fireEvent.click(screen.getByRole('button', { name: /^Search docs/ }));
    fireEvent.input(screen.getByRole('searchbox', { name: 'Search documentation' }), { target: { value: 'Idempotency-Key' } });
    expect(document.querySelector('[data-nsw-result]')?.getAttribute('href')).toBe('/docs/api-tokens-and-ci#submit-api');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows a real no-results state and replaces article content when the route changes', () => {
    const view = render(createElement(PublicContent, { path: '/docs/github', docs: true }));
    fireEvent.click(screen.getByRole('button', { name: /^Search docs/ }));
    fireEvent.input(screen.getByRole('searchbox', { name: 'Search documentation' }), { target: { value: 'quasarzzzzunfindable' } });
    expect(document.querySelector('[data-nsw-search-status]')?.textContent).toBe('No matching guides.');
    view.rerender(createElement(PublicContent, { path: '/docs/unknown', docs: true }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('We couldn’t find that guide.');
    expect(document.querySelectorAll('[data-nsw-result]')).toHaveLength(0);
  });
  it('reports clipboard success only after the promise succeeds and gives failure recovery', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(createElement(PublicContent, { path: '/docs/api-tokens-and-ci', docs: true }));
    const button = document.querySelector<HTMLButtonElement>('[data-nsw-copy]')!;
    fireEvent.click(button);
    await waitFor(() => expect(document.querySelector('.nsw-copy-status')?.textContent).toBe('Code copied to clipboard.'));
    expect(writeText).toHaveBeenCalledWith(document.querySelector('.nsw-code pre code')?.textContent);
    writeText.mockRejectedValueOnce(new Error('Denied'));
    fireEvent.click(button);
    await waitFor(() => expect(document.querySelector('.nsw-copy-status')?.textContent).toBe('Copy unavailable. Select the code and copy it manually.'));
    expect(button.textContent).toContain('Copy');
    expect(button.textContent).not.toContain('Copied');
  });
  it('removes global shortcuts on unmount and emits no ordinary capture notes', () => {
    const view = render(createElement(PublicContent, { path: '/docs/proof', docs: true }));
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    expect(document.querySelector('[data-nsw-capture]')).toBeNull();
    view.unmount();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(show).not.toHaveBeenCalled();
  });
});

import { DOC_ARTICLES } from './docs-content.ts';
import { searchDocs } from './search.ts';
import { renderSearchResults } from './render.ts';

/** Progressive enhancement for the public templates only. Returns complete effect cleanup. */
export function enhanceWebsite(root: HTMLElement): () => void {
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const search = root.querySelector<HTMLDialogElement>('#nsw-search-dialog');
  const menu = root.querySelector<HTMLDialogElement>('#nsw-nav-dialog');
  const input = root.querySelector<HTMLInputElement>('#nsw-search-input');
  const results = root.querySelector<HTMLElement>('[data-nsw-results]');
  const status = root.querySelector<HTMLElement>('[data-nsw-search-status]');
  const openers = new Map<HTMLDialogElement, HTMLElement>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const copying = new WeakSet<HTMLButtonElement>();
  const copyTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();
  let disposed = false;

  function open(dialog: HTMLDialogElement | null | undefined, opener: HTMLElement): void {
    if (!dialog || dialog.open) return;
    let returnFocus = opener;
    for (const other of [search, menu]) if (other?.open) {
      returnFocus = openers.get(other) ?? returnFocus;
      other.close();
    }
    openers.set(dialog, returnFocus);
    dialog.showModal();
    if (dialog === search) input?.focus();
    else dialog.querySelector<HTMLElement>('[data-nsw-close]')?.focus();
  }
  for (const dialog of [search, menu]) {
    dialog?.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || !dialog.open) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )).filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden');
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }, { signal });
    dialog?.addEventListener('close', () => {
      const opener = openers.get(dialog);
      if (!disposed && opener?.isConnected && ![search, menu].some(other => other?.open)) opener.focus({ preventScroll: true });
      openers.delete(dialog);
    }, { signal });
    dialog?.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }, { signal });
  }
  root.querySelector<HTMLFormElement>('[data-nsw-search-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    results?.querySelector<HTMLAnchorElement>('[data-nsw-result]')?.click();
  }, { signal });
  function updateSearch(): void {
    if (!input || !results || !status) return;
    const query = input.value.slice(0, 200).trim();
    const matches = searchDocs(DOC_ARTICLES, query);
    status.textContent = !query ? 'Type a word or phrase to search.'
      : matches.length ? `${matches.length} ${matches.length === 1 ? 'guide' : 'guides'} found.` : 'No matching guides.';
    results.innerHTML = renderSearchResults(matches);
    if (query && !matches.length) {
      const message = document.createElement('p');
      message.className = 'nsw-search-empty';
      message.textContent = `No results for “${query}”. Try “GitHub”, “token”, “verification” or fewer words.`;
      results.append(message);
    }
    results.scrollTop = 0;
  }
  input?.addEventListener('input', updateSearch, { signal });
  search?.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const links = Array.from(results?.querySelectorAll<HTMLAnchorElement>('[data-nsw-result]') ?? []);
    const index = links.findIndex(link => link === document.activeElement);
    if (event.target === input && event.key !== 'ArrowDown') return; // Keep text-editing keys native.
    if (!links.length || event.target !== input && index < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && index === 0) { input?.focus(); return; }
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : event.key === 'ArrowDown' ? Math.min(index + 1, links.length - 1) : Math.max(0, index - 1);
    links[next]?.focus();
  }, { signal });
  document.addEventListener('keydown', event => {
    if (!root.isConnected || event.repeat || event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && search) {
      event.preventDefault();
      const opener = root.querySelector<HTMLElement>('[data-nsw-open-search]') ?? root;
      if (search.open) search.close(); else open(search, opener);
    }
  }, { signal });
  async function copy(button: HTMLButtonElement): Promise<void> {
    const target = document.getElementById(button.dataset.nswCopy ?? '');
    const feedback = button.closest('.nsw-code')?.querySelector<HTMLElement>('.nsw-copy-status');
    if (!target || !root.contains(target) || copying.has(button)) return;
    copying.add(button);
    const earlierTimer = copyTimers.get(button);
    if (earlierTimer) { clearTimeout(earlierTimer); timers.delete(earlierTimer); copyTimers.delete(button); }
    const label = button.querySelector('span');
    if (label) label.textContent = 'Copying…';
    if (feedback) feedback.textContent = '';
    button.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(target.textContent ?? '');
      if (disposed) return;
      if (feedback) feedback.textContent = 'Code copied to clipboard.';
      if (label) label.textContent = 'Copied';
      const timer = setTimeout(() => {
        timers.delete(timer);
        copyTimers.delete(button);
        if (!disposed && label) label.textContent = 'Copy';
      }, 2000);
      timers.add(timer);
      copyTimers.set(button, timer);
    } catch {
      if (!disposed && label) label.textContent = 'Copy';
      if (!disposed && feedback) feedback.textContent = 'Copy unavailable. Select the code and copy it manually.';
    } finally {
      copying.delete(button);
      if (!disposed) button.disabled = false;
    }
  }
  root.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('button');
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute('data-nsw-open-search')) open(search, button);
    if (button.hasAttribute('data-nsw-open-menu')) open(menu, button);
    if (button.hasAttribute('data-nsw-close')) button.closest('dialog')?.close();
    if (button.hasAttribute('data-nsw-clear') && input) { input.value = ''; updateSearch(); input.focus(); }
    if (button.hasAttribute('data-nsw-copy')) void copy(button);
  }, { signal });

  function focusAnchor(): void {
    if (!location.hash) return;
    let id: string;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (target && root.contains(target)) {
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', focusAnchor, { signal });
  const frame = requestAnimationFrame(() => {
    if (location.hash) focusAnchor();
    else root.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  });
  const headingLinks = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-nsw-toc]'));
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    for (const link of headingLinks) {
      if (link.hash === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }, { rootMargin: '-100px 0px -55% 0px', threshold: 0 }) : null;
  root.querySelectorAll('.nsw-section h2[id]').forEach(heading => observer?.observe(heading));
  return () => {
    disposed = true;
    lifetime.abort();
    cancelAnimationFrame(frame);
    observer?.disconnect();
    timers.forEach(clearTimeout);
    for (const dialog of [search, menu]) if (dialog?.open) dialog.close();
    openers.clear();
  };
}

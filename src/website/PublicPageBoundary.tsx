import { Component, type ReactNode } from 'react';

/** Public chunk/render failure recovery only; never wraps authenticated routes. */
export class PublicPageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="mx-auto max-w-3xl px-5 py-16" role="alert">
      <h1 className="text-2xl">This page could not load.</h1>
      <p className="mt-4 text-sm">Reload to retry the page files, or return to support. No request has been submitted.</p>
      <button type="button" className="mt-5 rounded border border-white/30 px-4 py-3 focus-visible:outline-2" onClick={() => window.location.reload()}>Reload page</button>
      <p className="mt-5"><a className="underline" href="/support">Support</a></p>
    </main>;
    return this.props.children;
  }
}

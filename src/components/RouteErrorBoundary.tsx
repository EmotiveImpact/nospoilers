import { Component, type ReactNode } from 'react';

/** Chunk/render failure recovery for application routes: a short message and a reload, never a blank page. */
export class RouteErrorBoundary extends Component<{ children: ReactNode; label?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="mx-auto max-w-3xl px-5 py-16" role="alert">
      <h1 className="text-2xl">{this.props.label ?? 'This page'} could not load.</h1>
      <p className="mt-4 text-sm">The page files may have changed since you opened it. Reload to retry.</p>
      <button type="button" className="mt-5 rounded border border-current px-4 py-3 focus-visible:outline-2" onClick={() => window.location.reload()}>Reload page</button>
    </main>;
    return this.props.children;
  }
}

export function navigate(to: string): void {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function replacePath(to: string): void {
  window.history.replaceState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Remembers the last data each Watch page showed, for this browser tab only, so going back to a page
 * shows it straight away while a fresh copy loads quietly behind it. Without this every rail click
 * emptied the page for up to a second and then filled it again.
 *
 * Keys always carry the workspace and the exact request, so one workspace's view is never shown in
 * another. Nothing is written to storage: a reload, or signing out (which reloads), starts empty.
 */
const LIMIT = 80;
const memory = new Map<string, unknown>();

export function recallView<T>(key: string): T | undefined {
  return memory.get(key) as T | undefined;
}

export function rememberView<T>(key: string, value: T): T {
  memory.delete(key);
  memory.set(key, value);
  if (memory.size > LIMIT) memory.delete(memory.keys().next().value as string);
  return value;
}

export function forgetViews(prefix?: string): void {
  if (prefix === undefined) { memory.clear(); return; }
  for (const key of [...memory.keys()]) if (key.startsWith(prefix)) memory.delete(key);
}

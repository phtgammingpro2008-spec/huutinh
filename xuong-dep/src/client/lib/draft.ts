// Autosave of the order being edited, in localStorage. Every access is guarded: storage can be
// missing or full (private mode), and the editor must keep working without it.

export const NEW_POINTER = 'draft:new';
export const draftKey = (orderId: string) => `draft:${orderId}`;

export function saveDraft(orderId: string, data: unknown, isNew: boolean): void {
  try {
    localStorage.setItem(draftKey(orderId), JSON.stringify({ savedAt: Date.now(), data }));
    if (isNew) localStorage.setItem(NEW_POINTER, orderId);
  } catch { /* storage unavailable */ }
}

export function loadDraft<T>(orderId: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(orderId));
    return raw ? (JSON.parse(raw).data as T) : null;
  } catch {
    return null;
  }
}

/** Id of the unsaved new order, if any. */
export function pendingNewOrderId(): string | null {
  try { return localStorage.getItem(NEW_POINTER); } catch { return null; }
}

export function clearDraft(orderId: string): void {
  try {
    localStorage.removeItem(draftKey(orderId));
    if (localStorage.getItem(NEW_POINTER) === orderId) localStorage.removeItem(NEW_POINTER);
  } catch { /* ignore */ }
}

/** Calls `fn` once `ms` have passed without another call. `cancel()` drops a pending call. */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const run = (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  run.cancel = () => clearTimeout(t);
  return run;
}

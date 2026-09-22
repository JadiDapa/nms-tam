// Tiny in-process cache for read-only, slowly changing queries (the dashboard refreshes every 15 s, the data moves in 5-minute steps).
// Concurrent callers share one in-flight request; failures are never cached.
const store = new Map<string, { expires: number; value: Promise<unknown> }>();

export function ttlMemo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;

  const value = fn().catch((err) => {
    store.delete(key);
    throw err;
  });
  store.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

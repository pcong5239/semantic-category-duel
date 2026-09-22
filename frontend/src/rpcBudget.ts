export type RpcRow = { id: string; maxRequests: number; maxRetries: number; backoffMs: number; cacheMs: number };
export type RpcMetric = { rowId: string; key: string; source: 'network' | 'cache' | 'in-flight'; attempt: number; at: number };

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  signal.addEventListener('abort', abort, { once: true });
});

const retryable = (error: unknown) => {
  const value = error as { status?: number; code?: number };
  return value?.status === 429 || value?.code === 429 || value?.code === -32005 || value?.code === -32029;
};

export function createRpcBudget(rows: readonly RpcRow[]) {
  const matrix = new Map(rows.map((row) => [row.id, row]));
  if (matrix.size !== rows.length || rows.some((row) => !row.id || row.maxRequests < 1 || row.maxRetries < 0 || row.backoffMs < 0 || row.cacheMs < 0)) throw new Error('INVALID_RPC_BUDGET');
  const counts = new Map<string, number>();
  const cache = new Map<string, { value: unknown; expires: number }>();
  type Active = { promise: Promise<unknown>; controller: AbortController; users: number };
  const active = new Map<string, Active>();
  const metrics: RpcMetric[] = [];

  async function request<T>(input: { rowId: string; key: string; signal?: AbortSignal; call: () => Promise<T> }): Promise<T> {
    const row = matrix.get(input.rowId);
    if (!row) throw new Error(`UNKNOWN_RPC_BUDGET:${input.rowId}`);
    const signal = input.signal ?? new AbortController().signal;
    signal.throwIfAborted();
    const scoped = `${input.rowId}:${input.key}`;
    const hit = cache.get(scoped);
    if (hit && hit.expires > Date.now()) {
      metrics.push({ rowId: input.rowId, key: input.key, source: 'cache', attempt: 0, at: Date.now() });
      return hit.value as T;
    }
    const running = active.get(scoped);
    if (running) {
      metrics.push({ rowId: input.rowId, key: input.key, source: 'in-flight', attempt: 0, at: Date.now() });
      return subscribe<T>(running, signal);
    }
    const controller = new AbortController();
    const operation = (async () => {
      for (let attempt = 0; ; attempt += 1) {
        controller.signal.throwIfAborted();
        if (attempt + 1 > row.maxRequests) throw new Error(`RPC_BUDGET_EXCEEDED:${input.rowId}`);
        counts.set(input.rowId, (counts.get(input.rowId) ?? 0) + 1);
        metrics.push({ rowId: input.rowId, key: input.key, source: 'network', attempt, at: Date.now() });
        try {
          const value = await input.call();
          controller.signal.throwIfAborted();
          if (row.cacheMs) cache.set(scoped, { value, expires: Date.now() + row.cacheMs });
          return value;
        } catch (error) {
          if (!retryable(error) || attempt >= row.maxRetries) throw error;
          await wait(row.backoffMs * 2 ** attempt, controller.signal);
        }
      }
    })();
    const entry: Active = { promise: operation, controller, users: 0 };
    active.set(scoped, entry);
    void operation.finally(() => { if (active.get(scoped) === entry) active.delete(scoped); }).catch(() => {});
    return subscribe<T>(entry, signal);
  }

  function subscribe<T>(entry: Active, signal: AbortSignal): Promise<T> {
    entry.users += 1;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (failed: boolean, value: unknown) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        entry.users -= 1;
        if (entry.users === 0) entry.controller.abort(signal.reason);
        if (failed) reject(value); else resolve(value as T);
      };
      const abort = () => finish(true, signal.reason);
      signal.addEventListener('abort', abort, { once: true });
      void entry.promise.then((value) => finish(false, value), (error) => finish(true, error));
      if (signal.aborted) abort();
    });
  }

  function invalidate(prefix = '') {
    for (const key of cache.keys()) if (key.includes(prefix)) cache.delete(key);
  }

  return { request, invalidate, counts: () => Object.fromEntries(counts), evidence: () => metrics.slice() };
}

export const rpcBudget = createRpcBudget([
  { id: 'game-detail', maxRequests: 2, maxRetries: 1, backoffMs: 1000, cacheMs: 2000 },
  { id: 'nonce-readback', maxRequests: 2, maxRetries: 1, backoffMs: 1000, cacheMs: 0 },
  { id: 'version-readback', maxRequests: 2, maxRetries: 1, backoffMs: 1000, cacheMs: 0 },
  { id: 'write-finality', maxRequests: 1, maxRetries: 0, backoffMs: 0, cacheMs: 0 },
  { id: 'reconcile-finality', maxRequests: 1, maxRetries: 0, backoffMs: 0, cacheMs: 0 },
]);

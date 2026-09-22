import { describe, expect, it, vi } from 'vitest';
import { createRpcBudget } from '../src/rpcBudget';

const row = { id: 'read', maxRequests: 2, maxRetries: 1, backoffMs: 1, cacheMs: 1000 };

describe('shared RPC budget', () => {
  it('deduplicates an identical in-flight read and then uses safe cache', async () => {
    const budget = createRpcBudget([row]);
    let release!: (value: number) => void;
    const call = vi.fn(() => new Promise<number>((resolve) => { release = resolve; }));
    const one = budget.request({ rowId: 'read', key: 'same', call });
    const two = budget.request({ rowId: 'read', key: 'same', call });
    release(7);
    expect(await Promise.all([one, two])).toEqual([7, 7]);
    expect(await budget.request({ rowId: 'read', key: 'same', call })).toBe(7);
    expect(call).toHaveBeenCalledTimes(1);
    expect(budget.evidence().map((item) => item.source)).toEqual(['network', 'in-flight', 'cache']);
  });

  it('retries a rate limit once within the journey ceiling', async () => {
    vi.useFakeTimers();
    const budget = createRpcBudget([row]);
    const call = vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValueOnce(9);
    const result = budget.request({ rowId: 'read', key: 'retry', call });
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe(9);
    expect(budget.counts()).toEqual({ read: 2 });
    vi.useRealTimers();
  });

  it('does not retry after cancellation', async () => {
    const budget = createRpcBudget([row]);
    const controller = new AbortController();
    controller.abort(new Error('hidden'));
    await expect(budget.request({ rowId: 'read', key: 'cancel', signal: controller.signal, call: async () => 1 })).rejects.toThrow('hidden');
    expect(budget.counts()).toEqual({});
  });

  it('invalidates safe cache after an authoritative transition', async () => {
    const budget = createRpcBudget([row]);
    const call = vi.fn().mockResolvedValue(1);
    await budget.request({ rowId: 'read', key: 'case:1', call });
    budget.invalidate('case:1');
    await budget.request({ rowId: 'read', key: 'case:1', call });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('cancels a pending rate-limit backoff without another call', async () => {
    vi.useFakeTimers();
    const budget = createRpcBudget([row]);
    const controller = new AbortController();
    const call = vi.fn().mockRejectedValue({ status: 429 });
    const result = budget.request({ rowId: 'read', key: 'cancel-backoff', signal: controller.signal, call });
    await Promise.resolve();
    controller.abort(new Error('hidden'));
    await expect(result).rejects.toThrow('hidden');
    expect(call).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

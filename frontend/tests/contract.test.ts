import { describe, expect, it, vi } from 'vitest';
import { assertOperationReadback, createNonce, decodeJournalArgs, encodeAddress, encodeContractArgs, normalizeAddress, operationArgsHash, readGame, requirePositiveCaseId, verifyReconcileTransaction, waitForFinality, withReconcileSlot, writeWithEstimatedFees } from '../src/contract';

const finalized = { statusName: 'FINALIZED', txExecutionResultName: 'FINISHED_WITH_RETURN' };

it('encodes EVM addresses as address calldata rather than strings', () => {
  expect([...encodeAddress(`0x${'12'.repeat(20)}`).bytes]).toEqual(Array(20).fill(0x12));
});

it('encodes every Address ABI position without mutating ordinary arguments', () => {
  const address = `0x${'34'.repeat(20)}`;
  const bytes = (value: unknown) => [...(value as { bytes: Uint8Array }).bytes];
  expect(bytes(encodeContractArgs('create_game', ['nonce', address, 'ANIMAL', 'a'])[1])).toEqual(Array(20).fill(0x34));
  expect(bytes(encodeContractArgs('get_id_by_nonce', [address, 'nonce'])[0])).toEqual(Array(20).fill(0x34));
  expect(bytes(encodeContractArgs('list_actor', [address, 0n, 4n])[0])).toEqual(Array(20).fill(0x34));
  expect(encodeContractArgs('join_game', [3n, 1n])).toEqual([3n, 1n]);
});

describe('bounded finality polling', () => {
  it('estimates and forwards a nonzero fee preset before every write', async () => {
    const fees = { distribution: { leaderAmount: 1n }, feeValue: 1n };
    const client = {
      estimateTransactionFees: vi.fn().mockResolvedValue(fees),
      writeContract: vi.fn().mockResolvedValue(`0x${'e'.repeat(64)}`),
    };
    const transaction = { address: `0x${'1'.repeat(40)}`, functionName: 'create_game', args: [] };
    await writeWithEstimatedFees(client as never, transaction as never);
    expect(client.estimateTransactionFees).toHaveBeenCalledWith();
    expect(client.writeContract).toHaveBeenCalledWith({ ...transaction, fees });
  });
  it('never delegates retry policy to SDK defaults', async () => {
    vi.useFakeTimers();
    const client = { waitForFinalization: vi.fn().mockRejectedValueOnce(new Error('pending')).mockResolvedValue(finalized) };
    const result = waitForFinality(client as never, `0x${'a'.repeat(64)}`, undefined, [2, 4]);
    await vi.advanceTimersByTimeAsync(6);
    expect(await result).toBe(finalized);
    expect(client.waitForFinalization).toHaveBeenCalledTimes(2);
    expect(client.waitForFinalization).toHaveBeenNthCalledWith(1, expect.objectContaining({ interval: 0, retries: 0 }));
    vi.useRealTimers();
  });

  it('stops before another poll after cancellation', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const client = { waitForFinalization: vi.fn().mockRejectedValue(new Error('pending')) };
    const result = waitForFinality(client as never, `0x${'b'.repeat(64)}`, controller.signal, [2, 4]);
    await vi.advanceTimersByTimeAsync(2);
    controller.abort(new Error('unmounted'));
    await expect(result).rejects.toThrow('unmounted');
    expect(client.waitForFinalization).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('caps timeout and 429 recovery at three physical finality reads', async () => {
    vi.useFakeTimers();
    const timeoutClient = { waitForFinalization: vi.fn().mockRejectedValue(new Error('pending')) };
    const timeout = waitForFinality(timeoutClient as never, `0x${'c'.repeat(64)}`, undefined, [1, 1, 1]);
    const timedOut = expect(timeout).rejects.toThrow('pending');
    await vi.advanceTimersByTimeAsync(3);
    await timedOut;
    expect(timeoutClient.waitForFinalization).toHaveBeenCalledTimes(3);
    const limited = { waitForFinalization: vi.fn().mockRejectedValueOnce({ status: 429 }).mockResolvedValue(finalized) };
    const recovered = waitForFinality(limited as never, `0x${'d'.repeat(64)}`, undefined, [1, 1, 1]);
    await vi.advanceTimersByTimeAsync(2);
    await expect(recovered).resolves.toBe(finalized);
    expect(limited.waitForFinalization).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('allows at most two reconciliation operations concurrently', async () => {
    const releases: Array<() => void> = [];
    const pending = () => new Promise<void>((resolve) => { releases.push(resolve); });
    const one = withReconcileSlot(pending);
    const two = withReconcileSlot(pending);
    await expect(withReconcileSlot(async () => undefined)).rejects.toThrow('RECONCILE_CONCURRENCY_LIMIT');
    releases.forEach((release) => release());
    await Promise.all([one, two]);
  });
});

describe('authoritative operation readback', () => {
  it('creates the exact 32-character lowercase hex nonce accepted by the contract', () => {
    expect(createNonce()).toMatch(/^[0-9a-f]{32}$/);
  });
  it('rejects non-positive game IDs before issuing an RPC request', async () => {
    await expect(readGame(0n)).rejects.toThrow('Enter a positive game ID.');
  });
  it('rejects absent, malformed and mismatched historical state', async () => {
    const account = `0x${'1'.repeat(40)}` as const;
    await expect(assertOperationReadback('null', 'create_game', account)).rejects.toThrow('unavailable');
    await expect(assertOperationReadback('{', 'create_game', account)).rejects.toThrow();
    await expect(assertOperationReadback(JSON.stringify({ last_operation: { method: 'join_game', caller: account } }), 'create_game', account)).rejects.toThrow('does not match');
    expect(() => requirePositiveCaseId(0n)).toThrow('identity is unavailable');
    expect(() => requirePositiveCaseId(undefined)).toThrow('identity is unavailable');
  });

  it('accepts only the expected method and caller', async () => {
    const account = `0x${'2'.repeat(40)}` as const;
    await expect(assertOperationReadback(JSON.stringify({ last_operation: { method: 'create_game', caller: account.toUpperCase().replace('0X', '0x') } }), 'create_game', account)).resolves.toBeUndefined();
    const version = JSON.stringify({ last_operation: { method: 'join_game', caller: account, args_hash: '49a64717d5d4cb19952e6eac2946415cf6879adacf9908e7d872332d32c6e684' } });
    await expect(assertOperationReadback(version, 'join_game', account, [1n, 2n])).resolves.toBeUndefined();
    await expect(assertOperationReadback(version, 'join_game', account, [1n, 3n])).rejects.toThrow('arguments do not match');
  });

  it.each([
    ['join_game', [1n, 2n]],
    ['play_word', [1n, 'ant', 2n, 3n]],
    ['evaluate_move', [1n, 3n]],
    ['retry_move', [1n, 4n]],
    ['pass_turn', [1n, 2n, 3n]],
    ['resign_game', [1n, 3n]],
  ] as const)('restores %s journal numeric types and the original hash', async (method, args) => {
    const encoded = JSON.stringify(args, (_, value) => typeof value === 'bigint' ? value.toString() : value);
    const restored = decodeJournalArgs(method, encoded);
    expect(restored).toEqual(args);
    expect(await operationArgsHash(restored)).toBe(await operationArgsHash([...args]));
  });

  it('normalizes mixed-case create opponents before submission and hashing', async () => {
    const mixed = `0x${'Aa'.repeat(20)}`;
    expect(normalizeAddress(mixed)).toBe(mixed.toLowerCase());
    expect(await operationArgsHash(['nonce', normalizeAddress(mixed), 'ANIMAL', 'a']))
      .toBe(await operationArgsHash(['nonce', mixed.toLowerCase(), 'ANIMAL', 'a']));
  });

  it('rejects corrupt journal methods, arity and numeric encodings', () => {
    expect(() => decodeJournalArgs('unknown', '[]')).toThrow('JOURNAL_ARGS_CORRUPT');
    expect(() => decodeJournalArgs('join_game', '["1"]')).toThrow('JOURNAL_ARGS_CORRUPT');
    expect(() => decodeJournalArgs('join_game', '["01","2"]')).toThrow('JOURNAL_ARGS_CORRUPT');
  });

  it('emits reconciliation verification phases before readback success', async () => {
    const phases: string[] = [];
    const value = await verifyReconcileTransaction(finalized as never, async () => 7n, (phase) => phases.push(phase));
    expect(value).toBe(7n);
    expect(phases).toEqual(['VERIFYING_EXECUTION', 'VERIFYING_READBACK']);
  });
});

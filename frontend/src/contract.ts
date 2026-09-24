import { createClient, isSuccessful } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
import type { Address, Eip1193, Game, TxPhase } from './types';
import { reserveWrite, updateJournal, type JournalRecord } from './pending';
import { rpcBudget } from './rpcBudget';
import { contractAddress } from './config';

export class WriteError extends Error {
  constructor(message: string, readonly hash?: `0x${string}`) { super(message); }
}
export const createNonce = () => [...crypto.getRandomValues(new Uint8Array(16))].map((value) => value.toString(16).padStart(2, '0')).join('');
const executionFailure = (receipt: { statusName?: string; resultName?: string; txExecutionResultName?: string }) =>
  `Execution failed: ${[receipt.statusName, receipt.resultName, receipt.txExecutionResultName].filter(Boolean).join(' / ') || 'unknown result'}`;
export const readClient = createClient({ chain: studioDevnet });
type FinalizedTransaction = Awaited<ReturnType<typeof readClient.waitForFinalization>>;
type FeeTransaction = Omit<Parameters<typeof readClient.writeContract>[0], 'fees'>;

export async function writeWithEstimatedFees(client: Pick<typeof readClient, 'estimateTransactionFees' | 'writeContract'>, transaction: FeeTransaction) {
  const fees = await client.estimateTransactionFees();
  return client.writeContract({ ...transaction, fees });
}

export async function readGame(id: bigint, signal?: AbortSignal): Promise<Game | null> {
  if (id <= 0n) throw new Error('Enter a positive game ID.');
  if (!contractAddress) return null;
  const raw = await rpcBudget.request({ rowId: 'game-detail', key: `${studioDevnet.id}:${contractAddress}:get_case:${id}`, signal, call: () => readClient.readContract({ address: contractAddress, functionName: 'get_case', args: [id] }) });
  return raw === 'null' ? null : JSON.parse(String(raw)) as Game;
}

export async function idByNonce(creator: Address, nonce: string, signal?: AbortSignal): Promise<bigint> {
  const value = await rpcBudget.request({ rowId: 'nonce-readback', key: `${studioDevnet.id}:${contractAddress}:get_id_by_nonce:${creator}:${nonce}`, signal, call: () => readClient.readContract({ address: contractAddress, functionName: 'get_id_by_nonce', args: [creator, nonce] }) });
  return BigInt(String(value));
}

export type Calldata = null | boolean | number | bigint | string | Uint8Array | Calldata[] | { [key: string]: Calldata };

const numericPositions: Record<string, number[]> = {
  create_game: [],
  join_game: [0, 1],
  play_word: [0, 2, 3],
  evaluate_move: [0, 1],
  retry_move: [0, 1],
  pass_turn: [0, 1, 2],
  resign_game: [0, 1],
};
const argumentCounts: Record<string, number> = { create_game: 4, join_game: 2, play_word: 4, evaluate_move: 2, retry_move: 2, pass_turn: 3, resign_game: 2 };

export function decodeJournalArgs(method: string, encoded: string): Calldata[] {
  const args = JSON.parse(encoded) as unknown;
  if (!Array.isArray(args) || argumentCounts[method] === undefined || args.length !== argumentCounts[method]) throw new Error('JOURNAL_ARGS_CORRUPT');
  for (const index of numericPositions[method]) {
    if (typeof args[index] !== 'string' || !/^(0|[1-9][0-9]*)$/.test(args[index])) throw new Error('JOURNAL_ARGS_CORRUPT');
    args[index] = BigInt(args[index]);
  }
  return args as Calldata[];
}

export function normalizeAddress(value: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('Invalid address.');
  return value.toLowerCase() as Address;
}

const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const abort = () => { clearTimeout(timer); reject(signal?.reason); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  signal?.addEventListener('abort', abort, { once: true });
});

type FinalityClient = { waitForFinalization(input: { hash: never; interval: number; retries: number }): Promise<FinalizedTransaction> };

export async function waitForFinality(client: FinalityClient, hash: `0x${string}`, signal?: AbortSignal, delays = [2000, 2000, 4000], rowId = 'write-finality'): Promise<FinalizedTransaction> {
  let lastError: unknown;
  for (const waitMs of delays) {
    await delay(waitMs, signal);
    signal?.throwIfAborted();
    try {
      return await rpcBudget.request({
        rowId,
        key: `${hash}:${waitMs}:${Date.now()}`,
        signal,
        call: () => client.waitForFinalization({ hash: hash as never, interval: 0, retries: 0 }),
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('FINALITY_PENDING');
}

async function verifyReadback(method: string, account: Address, args: Calldata[], id?: bigint, revision?: bigint, signal?: AbortSignal): Promise<bigint | undefined> {
  let caseId = id;
  let nextRevision = revision;
  if (method === 'create_game') {
    caseId = await idByNonce(account, String(args[0]), signal);
    nextRevision = 1n;
  }
  caseId = requirePositiveCaseId(caseId);
  if (!nextRevision || nextRevision <= 0n) throw new Error('Authoritative operation identity is unavailable.');
  const version = await rpcBudget.request({ rowId: 'version-readback', key: `${studioDevnet.id}:${contractAddress}:get_version:${caseId}:${nextRevision}`, signal, call: () => readClient.readContract({ address: contractAddress, functionName: 'get_version', args: [caseId!, nextRevision!] }) });
  if (version === 'null') throw new Error('Authoritative historical readback is unavailable.');
  await assertOperationReadback(version, method, account, args);
  return caseId;
}

export function requirePositiveCaseId(value: bigint | undefined): bigint {
  if (!value || value <= 0n) throw new Error('Authoritative operation identity is unavailable.');
  return value;
}

export async function operationArgsHash(args: Calldata[]): Promise<string> {
  // Every numeric ABI field in this contract is bounded to 32, so converting
  // restored bigint values to JSON number tokens is exact and matches Python.
  const wire = JSON.stringify(args, (_, value) => typeof value === 'bigint' ? Number(value) : value);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(wire));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function assertOperationReadback(version: unknown, method: string, account: Address, args?: Calldata[]): Promise<void> {
  if (version === 'null' || version === null || version === undefined) throw new Error('Authoritative historical readback is unavailable.');
  const parsed = JSON.parse(String(version)) as { last_operation?: { method?: string; caller?: string; args_hash?: string } };
  if (parsed.last_operation?.method !== method || parsed.last_operation?.caller?.toLowerCase() !== account.toLowerCase()) throw new Error('Authoritative readback does not match this operation.');
  if (args && parsed.last_operation.args_hash !== await operationArgsHash(args)) throw new Error('Authoritative readback arguments do not match this operation.');
}

export async function verifyReconcileTransaction<T>(transaction: FinalizedTransaction, readback: () => Promise<T>, onPhase?: (phase: TxPhase) => void): Promise<T> {
  onPhase?.('VERIFYING_EXECUTION');
  if (!isSuccessful(transaction)) throw new Error(executionFailure(transaction));
  onPhase?.('VERIFYING_READBACK');
  return readback();
}

export async function writeAndVerify(input: { provider: Eip1193; account: Address; method: string; args: Calldata[]; id?: bigint; nextRevision?: bigint; signal?: AbortSignal; onPhase: (phase: TxPhase, hash?: string) => void }): Promise<{ hash: `0x${string}`; id?: bigint }> {
  if (!contractAddress) throw new Error('Contract address is not configured.');
  const client = createClient({ chain: studioDevnet, account: input.account, provider: input.provider });
  const json = JSON.stringify(input.args, (_, value) => typeof value === 'bigint' ? value.toString() : value);
  const journal = await reserveWrite(localStorage, { chain: String(studioDevnet.id), contract: contractAddress, account: input.account, method: input.method, intent: `${input.method}:${input.id ?? 0}:${input.nextRevision ?? 0}`, args_json: json, pre_revision: String((input.nextRevision ?? 1n) - 1n), pre_hash: '' });
  let hash: `0x${string}` | undefined;
  try {
    input.onPhase('WAITING_FOR_WALLET');
    const transaction = { address: contractAddress, functionName: input.method, args: input.args, value: 0n };
    hash = await writeWithEstimatedFees(client, transaction) as `0x${string}`;
    await updateJournal(localStorage, journal.reservation, { tx_hash: hash, status: 'SUBMITTED' });
    input.onPhase('SUBMITTED', hash);
    input.onPhase('WAITING_FOR_FINALITY', hash);
    const receipt = await waitForFinality(client, hash, input.signal);
    input.onPhase('VERIFYING_EXECUTION', hash);
    if (!isSuccessful(receipt)) throw new Error(executionFailure(receipt));
    input.onPhase('VERIFYING_READBACK', hash);
    const id = await verifyReadback(input.method, input.account, input.args, input.id, input.nextRevision, input.signal);
    await updateJournal(localStorage, journal.reservation, { status: 'VERIFIED' });
    rpcBudget.invalidate(`${studioDevnet.id}:${contractAddress}`);
    input.onPhase('SUCCESS', hash);
    return { hash, id };
  } catch (error) {
    await updateJournal(localStorage, journal.reservation, { status: hash ? 'RECONCILE' : 'FINALIZED_ERROR' });
    throw new WriteError(error instanceof Error ? error.message : 'Transaction failed.', hash);
  }
}

let activeReconciliations = 0;

export async function withReconcileSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeReconciliations >= 2) throw new Error('RECONCILE_CONCURRENCY_LIMIT');
  activeReconciliations += 1;
  try {
    return await operation();
  } finally {
    activeReconciliations -= 1;
  }
}

export async function reconcileWrite(record: JournalRecord, signal?: AbortSignal, onPhase?: (phase: TxPhase) => void): Promise<bigint | undefined> {
  if (!record.tx_hash || record.chain !== String(studioDevnet.id) || record.contract.toLowerCase() !== contractAddress.toLowerCase()) throw new Error('RECONCILE_CONTEXT_MISMATCH');
  return withReconcileSlot(async () => {
    const transaction = await waitForFinality(readClient, record.tx_hash as `0x${string}`, signal, [0], 'reconcile-finality');
    if (!isSuccessful(transaction)) {
      await updateJournal(localStorage, record.reservation, { status: 'FINALIZED_ERROR' });
      throw new Error(executionFailure(transaction));
    }
    const args = decodeJournalArgs(record.method, record.args_json);
    const id = record.method === 'create_game' ? undefined : BigInt(String(args[0]));
    const revision = BigInt(record.pre_revision) + 1n;
    const caseId = await verifyReconcileTransaction(transaction, () => verifyReadback(record.method, record.account, args, id, revision, signal), onPhase);
    await updateJournal(localStorage, record.reservation, { status: 'VERIFIED' });
    rpcBudget.invalidate(`${studioDevnet.id}:${contractAddress}`);
    return caseId;
  });
}

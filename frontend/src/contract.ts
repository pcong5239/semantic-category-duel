import { createClient, isSuccessful } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
import type { Address, Eip1193, Game, TxPhase } from './types';
import { reserveWrite, updateJournal, type JournalRecord } from './pending';
import { rpcBudget } from './rpcBudget';
import { contractAddress } from './config';

export class WriteError extends Error {
  constructor(message: string, readonly hash?: `0x${string}`) { super(message); }
}
export const readClient = createClient({ chain: studioDevnet });

export async function readGame(id: bigint): Promise<Game | null> {
  if (!contractAddress) return null;
  const raw = await rpcBudget.request({ rowId: 'game-detail', key: `${studioDevnet.id}:${contractAddress}:get_case:${id}`, call: () => readClient.readContract({ address: contractAddress, functionName: 'get_case', args: [id] }) });
  return raw === 'null' ? null : JSON.parse(String(raw)) as Game;
}

export async function idByNonce(creator: Address, nonce: string): Promise<bigint> {
  const value = await rpcBudget.request({ rowId: 'nonce-readback', key: `${studioDevnet.id}:${contractAddress}:get_id_by_nonce:${creator}:${nonce}`, call: () => readClient.readContract({ address: contractAddress, functionName: 'get_id_by_nonce', args: [creator, nonce] }) });
  return BigInt(String(value));
}

export type Calldata = null | boolean | number | bigint | string | Uint8Array | Calldata[] | { [key: string]: Calldata };

async function verifyReadback(method: string, account: Address, args: Calldata[], id?: bigint, revision?: bigint): Promise<bigint | undefined> {
  let caseId = id;
  let nextRevision = revision;
  if (method === 'create_game') {
    caseId = await idByNonce(account, String(args[0]));
    nextRevision = 1n;
  }
  if (!caseId || !nextRevision) return caseId;
  const version = await rpcBudget.request({ rowId: 'version-readback', key: `${studioDevnet.id}:${contractAddress}:get_version:${caseId}:${nextRevision}`, call: () => readClient.readContract({ address: contractAddress, functionName: 'get_version', args: [caseId!, nextRevision!] }) });
  if (version === 'null') throw new Error('Authoritative historical readback is unavailable.');
  const parsed = JSON.parse(String(version)) as { last_operation?: { method?: string; caller?: string } };
  if (parsed.last_operation?.method !== method || parsed.last_operation?.caller?.toLowerCase() !== account.toLowerCase()) throw new Error('Authoritative readback does not match this operation.');
  return caseId;
}

export async function writeAndVerify(input: { provider: Eip1193; account: Address; method: string; args: Calldata[]; id?: bigint; nextRevision?: bigint; onPhase: (phase: TxPhase, hash?: string) => void }): Promise<{ hash: `0x${string}`; id?: bigint }> {
  if (!contractAddress) throw new Error('Contract address is not configured.');
  const client = createClient({ chain: studioDevnet, account: input.account, provider: input.provider });
  const json = JSON.stringify(input.args, (_, value) => typeof value === 'bigint' ? value.toString() : value);
  const journal = await reserveWrite(localStorage, { chain: String(studioDevnet.id), contract: contractAddress, account: input.account, method: input.method, intent: `${input.method}:${input.id ?? 0}:${input.nextRevision ?? 0}`, args_json: json, pre_revision: String((input.nextRevision ?? 1n) - 1n), pre_hash: '' });
  let hash: `0x${string}` | undefined;
  try {
    input.onPhase('WAITING_FOR_WALLET');
    hash = await client.writeContract({ address: contractAddress, functionName: input.method, args: input.args, value: 0n }) as `0x${string}`;
    await updateJournal(localStorage, journal.reservation, { tx_hash: hash, status: 'SUBMITTED' });
    input.onPhase('SUBMITTED', hash);
    input.onPhase('WAITING_FOR_FINALITY', hash);
    const receipt = await client.waitForFinalization({ hash: hash as never });
    input.onPhase('VERIFYING_EXECUTION', hash);
    if (!isSuccessful(receipt)) throw new Error(`Execution failed: ${receipt.statusName} / ${receipt.resultName} / ${receipt.txExecutionResultName}`);
    input.onPhase('VERIFYING_READBACK', hash);
    const id = await verifyReadback(input.method, input.account, input.args, input.id, input.nextRevision);
    await updateJournal(localStorage, journal.reservation, { status: 'VERIFIED' });
    rpcBudget.invalidate(`${studioDevnet.id}:${contractAddress}`);
    input.onPhase('SUCCESS', hash);
    return { hash, id };
  } catch (error) {
    await updateJournal(localStorage, journal.reservation, { status: hash ? 'RECONCILE' : 'FINALIZED_ERROR' });
    throw new WriteError(error instanceof Error ? error.message : 'Transaction failed.', hash);
  }
}

export async function reconcileWrite(record: JournalRecord): Promise<bigint | undefined> {
  if (!record.tx_hash || record.chain !== String(studioDevnet.id) || record.contract.toLowerCase() !== contractAddress.toLowerCase()) throw new Error('RECONCILE_CONTEXT_MISMATCH');
  const transaction = await readClient.waitForFinalization({ hash: record.tx_hash as never });
  if (!isSuccessful(transaction)) throw new Error(`Execution failed: ${transaction.statusName} / ${transaction.resultName} / ${transaction.txExecutionResultName}`);
  const args = JSON.parse(record.args_json) as Calldata[];
  const id = record.method === 'create_game' ? undefined : BigInt(String(args[0]));
  const revision = BigInt(record.pre_revision) + 1n;
  const caseId = await verifyReadback(record.method, record.account, args, id, revision);
  await updateJournal(localStorage, record.reservation, { status: 'VERIFIED' });
  rpcBudget.invalidate(`${studioDevnet.id}:${contractAddress}`);
  return caseId;
}

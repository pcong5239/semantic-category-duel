import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import type { Address, Eip1193, Game } from './types';
import { reserveWrite, updateJournal } from './pending';

export type TxPhase = 'IDLE' | 'WAITING_FOR_WALLET' | 'SUBMITTED' | 'WAITING_FOR_FINALITY' | 'VERIFYING_EXECUTION' | 'VERIFYING_READBACK' | 'SUCCESS' | 'REJECTED' | 'FAILED' | 'RECONCILIATION_REQUIRED';
export const contractAddress = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as Address;
export const readClient = createClient({ chain: studionet });

export async function readGame(id: bigint): Promise<Game | null> {
  if (!contractAddress) return null;
  const raw = await readClient.readContract({ address: contractAddress, functionName: 'get_case', args: [id] });
  return raw === 'null' ? null : JSON.parse(String(raw)) as Game;
}

export async function idByNonce(creator: Address, nonce: string): Promise<bigint> {
  const value = await readClient.readContract({ address: contractAddress, functionName: 'get_id_by_nonce', args: [creator, nonce] });
  return BigInt(String(value));
}

export type Calldata = null | boolean | number | bigint | string | Uint8Array | Calldata[] | { [key: string]: Calldata };

export async function writeAndVerify(input: { provider: Eip1193; account: Address; method: string; args: Calldata[]; id?: bigint; nextRevision?: bigint; onPhase: (phase: TxPhase, hash?: string) => void }): Promise<`0x${string}`> {
  if (!contractAddress) throw new Error('Contract address is not configured.');
  const client = createClient({ chain: studionet, account: input.account, provider: input.provider });
  const json = JSON.stringify(input.args, (_, value) => typeof value === 'bigint' ? value.toString() : value);
  const journal = await reserveWrite(localStorage, { chain: String(studionet.id), contract: contractAddress, account: input.account, method: input.method, intent: `${input.method}:${input.id ?? 0}:${input.nextRevision ?? 0}`, args_json: json, pre_revision: String((input.nextRevision ?? 1n) - 1n), pre_hash: '' });
  let hash: `0x${string}` | undefined;
  try {
    input.onPhase('WAITING_FOR_WALLET');
    hash = await client.writeContract({ address: contractAddress, functionName: input.method, args: input.args, value: 0n }) as `0x${string}`;
    await updateJournal(localStorage, journal.reservation, { tx_hash: hash, status: 'SUBMITTED' });
    input.onPhase('SUBMITTED', hash);
    input.onPhase('WAITING_FOR_FINALITY', hash);
    const receipt = await client.waitForTransactionReceipt({ hash: hash as never, status: 'FINALIZED' as never });
    input.onPhase('VERIFYING_EXECUTION', hash);
    if (receipt.resultName !== 'SUCCESS' || receipt.txExecutionResultName !== 'FINISHED_WITH_RETURN') throw new Error(`Execution failed: ${receipt.statusName} / ${receipt.resultName} / ${receipt.txExecutionResultName}`);
    input.onPhase('VERIFYING_READBACK', hash);
    if (input.id && input.nextRevision) {
      const version = await readClient.readContract({ address: contractAddress, functionName: 'get_version', args: [input.id, input.nextRevision] });
      if (version === 'null') throw new Error('Authoritative historical readback is unavailable.');
      const parsed = JSON.parse(String(version)) as { last_operation?: { method?: string; caller?: string } };
      if (parsed.last_operation?.method !== input.method || parsed.last_operation?.caller?.toLowerCase() !== input.account.toLowerCase()) throw new Error('Authoritative readback does not match this operation.');
    }
    await updateJournal(localStorage, journal.reservation, { status: 'VERIFIED' });
    input.onPhase('SUCCESS', hash);
    return hash;
  } catch (error) {
    await updateJournal(localStorage, journal.reservation, { status: hash ? 'RECONCILE' : 'FINALIZED_ERROR' });
    throw error;
  }
}

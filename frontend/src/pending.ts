import type { Address } from './types';

export type JournalStatus = 'SIGNING' | 'SUBMITTED' | 'RECONCILE' | 'FINALIZED_ERROR' | 'VERIFIED';
export type JournalRecord = { v: 1; reservation: string; chain: string; contract: Address; account: Address; method: string; intent: string; args_json: string; pre_revision: string; pre_hash: string; tx_hash: string; status: JournalStatus; created_ms: string };
const INDEX = 'glj1:index';
const PREFIX = 'glj1:';
const terminal = new Set<JournalStatus>(['FINALIZED_ERROR', 'VERIFIED']);

const hex = (bytes: Uint8Array) => [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
export const reservation = () => hex(crypto.getRandomValues(new Uint8Array(16)));

export function loadJournal(storage: Storage): JournalRecord[] {
  const result: JournalRecord[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PREFIX) || key === INDEX) continue;
    const value = JSON.parse(storage.getItem(key) ?? 'null') as JournalRecord;
    if (value?.v !== 1 || `${PREFIX}${value.reservation}` !== key) throw new Error('JOURNAL_CORRUPT');
    result.push(value);
  }
  result.sort((a, b) => BigInt(a.created_ms) < BigInt(b.created_ms) ? -1 : 1);
  storage.setItem(INDEX, JSON.stringify(result.map((r) => `${PREFIX}${r.reservation}`)));
  return result;
}

export async function reserveWrite(storage: Storage, draft: Omit<JournalRecord, 'v' | 'reservation' | 'status' | 'tx_hash' | 'created_ms'>): Promise<JournalRecord> {
  if (!navigator.locks) throw new Error('Journal lock unavailable');
  return navigator.locks.request('genlayer-journal-v1', async () => {
    const records = loadJournal(storage);
    if (records.length >= 32) throw new Error('JOURNAL_CAPACITY');
    const caseKey = draft.intent.split(':').slice(1, 3).join(':');
    if (records.some((r) => !terminal.has(r.status) && r.chain === draft.chain && r.contract === draft.contract && r.account === draft.account && r.intent.split(':').slice(1, 3).join(':') === caseKey)) throw new Error('PENDING_CONFLICT');
    const record: JournalRecord = { ...draft, v: 1, reservation: reservation(), status: 'SIGNING', tx_hash: '', created_ms: String(Date.now()) };
    const key = `${PREFIX}${record.reservation}`;
    storage.setItem(key, JSON.stringify(record));
    storage.setItem(INDEX, JSON.stringify([...records.map((r) => `${PREFIX}${r.reservation}`), key]));
    return record;
  });
}

export async function updateJournal(storage: Storage, reservationId: string, patch: Partial<Pick<JournalRecord, 'status' | 'tx_hash'>>): Promise<JournalRecord> {
  if (!navigator.locks) throw new Error('Journal lock unavailable');
  return navigator.locks.request('genlayer-journal-v1', async () => {
    const key = `${PREFIX}${reservationId}`;
    const record = JSON.parse(storage.getItem(key) ?? 'null') as JournalRecord | null;
    if (!record) throw new Error('JOURNAL_NOT_FOUND');
    if (record.tx_hash && patch.tx_hash && record.tx_hash !== patch.tx_hash) throw new Error('HASH_IMMUTABLE');
    const next = { ...record, ...patch };
    storage.setItem(key, JSON.stringify(next));
    return next;
  });
}

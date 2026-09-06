import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadJournal, reserveWrite, updateJournal } from '../src/pending';

beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_: string, fn: () => unknown) => fn() } }); });
const draft = { chain: '61999', contract: `0x${'1'.repeat(40)}` as const, account: `0x${'2'.repeat(40)}` as const, method: 'play_word', intent: 'play_word:1:2:0', args_json: '[]', pre_revision: '2', pre_hash: 'a'.repeat(64) };
describe('durable journal', () => {
  it('reserves immutable random attempt keys and rebuilds its index', async () => { vi.spyOn(crypto, 'getRandomValues').mockImplementation((a) => { (a as Uint8Array).fill(7); return a; }); const item = await reserveWrite(localStorage, draft); expect(item.reservation).toHaveLength(32); localStorage.removeItem('glj1:index'); expect(loadJournal(localStorage)).toHaveLength(1); });
  it('blocks same-case pending operations before signing', async () => { await reserveWrite(localStorage, draft); await expect(reserveWrite(localStorage, { ...draft, method: 'pass_turn', intent: 'pass_turn:1:2:0' })).rejects.toThrow('PENDING_CONFLICT'); });
  it('never replaces a known transaction hash', async () => { const item = await reserveWrite(localStorage, draft); await updateJournal(localStorage, item.reservation, { tx_hash: `0x${'a'.repeat(64)}`, status: 'SUBMITTED' }); await expect(updateJournal(localStorage, item.reservation, { tx_hash: `0x${'b'.repeat(64)}` })).rejects.toThrow('HASH_IMMUTABLE'); });
});

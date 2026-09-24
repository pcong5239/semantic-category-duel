import { describe, expect, it } from 'vitest';
import { accountSessionAction, availableWallets, bindProviderEvents, canWrite, discoverLegacy, mergeOptions, optionFromAnnouncement, walletReducer, initialWallet } from '../src/wallet';

const provider = (flags: object = {}) => ({ request: async () => [], ...flags });
describe('wallet discovery and canonical session', () => {
  it('renders no synthetic options when no provider exists', () => expect(discoverLegacy({} as Window & typeof globalThis)).toEqual([]));
  it('lists only detected supported wallets', () => {
    const metamask = provider({ isMetaMask: true });
    const rabby = provider({ isRabby: true });
    const win = { ethereum: { providers: [metamask, rabby] } } as unknown as Window & typeof globalThis;
    expect(discoverLegacy(win).map((item) => item.name)).toEqual(['MetaMask', 'Rabby']);
  });
  it('does not mix ambiguous legacy globals into EIP-6963 announcements', () => {
    const okx = { id: 'okx', name: 'OKX Wallet' as const, provider: provider() };
    const ambiguous = provider({ isMetaMask: true });
    const win = { ethereum: ambiguous } as unknown as Window & typeof globalThis;
    expect(availableWallets([okx], win)).toEqual([okx]);
    expect(availableWallets([], win).map((item) => item.name)).toEqual(['MetaMask']);
  });
  it('rejects unsupported EIP-6963 announcements', () => expect(optionFromAnnouncement({ info: { uuid: '1', name: 'Other' }, provider: provider() })).toBeUndefined());
  it('deduplicates repeated announcements by uuid or provider identity', () => {
    const shared = provider();
    const first = { id: 'one', name: 'MetaMask' as const, provider: shared };
    const replacement = { id: 'two', name: 'MetaMask' as const, provider: shared };
    expect(mergeOptions([first], [first, replacement])).toEqual([replacement]);
  });
  it('retains distinct installed wallets even when names match', () => {
    const one = { id: 'one', name: 'MetaMask' as const, provider: provider() };
    const two = { id: 'two', name: 'MetaMask' as const, provider: provider() };
    expect(mergeOptions([one], [two])).toHaveLength(2);
  });
  it('removes every selected-provider listener on teardown', () => {
    const added: string[] = [];
    const removed: string[] = [];
    const selected = { request: async () => [], on: (event: string) => added.push(event), removeListener: (event: string) => removed.push(event) };
    const stop = bindProviderEvents(selected, { accountsChanged: () => {}, chainChanged: () => {}, disconnect: () => {} });
    expect(added).toEqual(['accountsChanged', 'chainChanged', 'disconnect']);
    stop();
    expect(removed).toEqual(added);
  });
  it('cannot be connected and expose disconnected state simultaneously', () => {
    const option = { id: 'm', name: 'MetaMask' as const, provider: provider() };
    const selecting = walletReducer(initialWallet, { type: 'CONNECTING', option });
    const connected = walletReducer(selecting, { type: 'CONNECTED', account: '0x123' });
    expect(connected.phase).toBe('CONNECTED'); expect(connected.selected).toBe(option);
  });
  it('keeps writes disabled when a wrong-chain event is followed by an account event', async () => {
    const selected = { id: 'm', name: 'MetaMask' as const, provider: provider() };
    const connected = walletReducer(walletReducer(initialWallet, { type: 'CONNECTING', option: selected }), { type: 'CONNECTED', account: '0x123', chain: '0xf22d' });
    const wrong = walletReducer(connected, { type: 'WRONG_CHAIN', chain: '0x1' });
    const action = await accountSessionAction({ request: async () => '0x1' }, ['0xABC']);
    const afterAccount = walletReducer(wrong, action);
    expect(afterAccount.phase).toBe('WRONG_CHAIN');
    expect(canWrite(afterAccount)).toBe(false);
  });
  it('enables writes only after chain and accounts are both re-read on Studio Devnet', async () => {
    const selected = { id: 'm', name: 'MetaMask' as const, provider: provider() };
    const action = await accountSessionAction({ request: async () => '0xf22d' }, ['0xABC']);
    const recovered = walletReducer(walletReducer(initialWallet, { type: 'CONNECTING', option: selected }), action);
    expect(recovered).toMatchObject({ phase: 'CONNECTED', account: '0xabc', chain: '0xf22d' });
    expect(canWrite(recovered)).toBe(true);
    expect(await accountSessionAction({ request: async () => '0xf22d' }, [])).toEqual({ type: 'DISCONNECT' });
  });
});

import { describe, expect, it } from 'vitest';
import { bindProviderEvents, discoverLegacy, mergeOptions, optionFromAnnouncement, walletReducer, initialWallet } from '../src/wallet';

const provider = (flags: object = {}) => ({ request: async () => [], ...flags });
describe('wallet discovery and canonical session', () => {
  it('renders no synthetic options when no provider exists', () => expect(discoverLegacy({} as Window & typeof globalThis)).toEqual([]));
  it('lists only detected supported wallets', () => {
    const metamask = provider({ isMetaMask: true });
    const rabby = provider({ isRabby: true });
    const win = { ethereum: { providers: [metamask, rabby] } } as unknown as Window & typeof globalThis;
    expect(discoverLegacy(win).map((item) => item.name)).toEqual(['MetaMask', 'Rabby']);
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
});

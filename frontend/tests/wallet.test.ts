import { describe, expect, it } from 'vitest';
import { discoverLegacy, optionFromAnnouncement, walletReducer, initialWallet } from '../src/wallet';

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
  it('cannot be connected and expose disconnected state simultaneously', () => {
    const option = { id: 'm', name: 'MetaMask' as const, provider: provider() };
    const selecting = walletReducer(initialWallet, { type: 'CONNECTING', option });
    const connected = walletReducer(selecting, { type: 'CONNECTED', account: '0x123' });
    expect(connected.phase).toBe('CONNECTED'); expect(connected.selected).toBe(option);
  });
});

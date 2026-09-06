import type { Address, Eip1193 } from './types';

export type WalletName = 'MetaMask' | 'OKX Wallet' | 'Rabby';
export type WalletOption = { id: string; name: WalletName; provider: Eip1193 };
export type WalletPhase = 'DISCONNECTED' | 'DISCOVERING' | 'CHOOSER_OPEN' | 'CONNECTING' | 'CONNECTED' | 'WRONG_CHAIN' | 'ERROR';
export type WalletState = { phase: WalletPhase; options: WalletOption[]; selected?: WalletOption; account?: Address; chain?: string; error?: string };

const supported = (name: string, rdns = ''): WalletName | undefined => {
  const key = `${name} ${rdns}`.toLowerCase();
  if (key.includes('rabby')) return 'Rabby';
  if (key.includes('okx')) return 'OKX Wallet';
  if (key.includes('metamask')) return 'MetaMask';
};

export function discoverLegacy(win: Window & typeof globalThis): WalletOption[] {
  const source = (win as unknown as { ethereum?: Eip1193 & { providers?: Eip1193[]; isMetaMask?: boolean; isOkxWallet?: boolean; isRabby?: boolean } }).ethereum;
  if (!source) return [];
  const providers = source.providers?.length ? source.providers : [source];
  const seen = new Set<Eip1193>();
  return providers.flatMap((provider, index) => {
    if (seen.has(provider)) return [];
    seen.add(provider);
    const flags = provider as Eip1193 & { isMetaMask?: boolean; isOkxWallet?: boolean; isRabby?: boolean };
    const name = flags.isRabby ? 'Rabby' : flags.isOkxWallet ? 'OKX Wallet' : flags.isMetaMask ? 'MetaMask' : undefined;
    return name ? [{ id: `legacy-${name}-${index}`, name, provider }] : [];
  });
}

export function optionFromAnnouncement(detail: unknown): WalletOption | undefined {
  const value = detail as { info?: { uuid?: string; name?: string; rdns?: string }; provider?: Eip1193 };
  const name = supported(value.info?.name ?? '', value.info?.rdns ?? '');
  return name && value.info?.uuid && value.provider?.request ? { id: value.info.uuid, name, provider: value.provider } : undefined;
}

export const initialWallet: WalletState = { phase: 'DISCONNECTED', options: [] };

export function walletReducer(state: WalletState, action: { type: string; option?: WalletOption; options?: WalletOption[]; account?: Address; chain?: string; error?: string }): WalletState {
  switch (action.type) {
    case 'DISCOVER': return { phase: 'CHOOSER_OPEN', options: action.options ?? [] };
    case 'CONNECTING': return { ...state, phase: 'CONNECTING', selected: action.option, error: undefined };
    case 'CONNECTED': return { ...state, phase: 'CONNECTED', account: action.account, chain: action.chain, error: undefined };
    case 'WRONG_CHAIN': return { ...state, phase: 'WRONG_CHAIN', chain: action.chain, error: 'Switch to Studionet to continue.' };
    case 'ERROR': return { ...state, phase: 'ERROR', error: action.error ?? 'Wallet connection failed.' };
    case 'DISCONNECT': return initialWallet;
    default: return state;
  }
}

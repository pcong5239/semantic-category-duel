import type { Address, Eip1193 } from './types';

export type WalletName = 'MetaMask' | 'OKX Wallet' | 'Rabby';
export type WalletOption = { id: string; name: WalletName; provider: Eip1193 };
export type WalletPhase = 'DISCONNECTED' | 'DISCOVERING' | 'CHOOSER_OPEN' | 'CONNECTING' | 'CONNECTED' | 'WRONG_CHAIN' | 'ERROR';
export type WalletState = { phase: WalletPhase; options: WalletOption[]; selected?: WalletOption; account?: Address; chain?: string; error?: string };
export type WalletAction = { type: string; option?: WalletOption; options?: WalletOption[]; account?: Address; chain?: string; error?: string };
export const STUDIO_CHAIN = '0xf22d';

const supported = (name: string, rdns = ''): WalletName | undefined => {
  const key = `${name} ${rdns}`.toLowerCase();
  if (key.includes('rabby')) return 'Rabby';
  if (key.includes('okx')) return 'OKX Wallet';
  if (key.includes('metamask')) return 'MetaMask';
};

export function discoverLegacy(win: Window & typeof globalThis): WalletOption[] {
  const walletWindow = win as unknown as {
    ethereum?: Eip1193 & { providers?: Eip1193[] };
    okxwallet?: Eip1193 | { ethereum?: Eip1193 };
    rabby?: Eip1193 | { ethereum?: Eip1193 };
  };
  const injected = walletWindow.ethereum;
  const unwrap = (value: Eip1193 | { ethereum?: Eip1193 } | undefined) =>
    value && 'request' in value ? value as Eip1193 : value?.ethereum;
  const explicit = [unwrap(walletWindow.okxwallet), unwrap(walletWindow.rabby)].filter((item): item is Eip1193 => Boolean(item?.request));
  const providers = injected?.providers?.length ? [...injected.providers, ...explicit] : explicit.length ? explicit : injected ? [injected] : [];
  const seen = new Set<Eip1193>();
  const names = new Set<WalletName>();
  return providers.flatMap((provider, index) => {
    if (seen.has(provider)) return [];
    seen.add(provider);
    const flags = provider as Eip1193 & { isMetaMask?: boolean; isOkxWallet?: boolean; isOKExWallet?: boolean; isRabby?: boolean };
    const identities = [flags.isRabby && 'Rabby', (flags.isOkxWallet || flags.isOKExWallet) && 'OKX Wallet', flags.isMetaMask && 'MetaMask'].filter(Boolean) as WalletName[];
    if (identities.length !== 1 || names.has(identities[0])) return [];
    names.add(identities[0]);
    return [{ id: `legacy-${identities[0]}-${index}`, name: identities[0], provider }];
  });
}

export const availableWallets = (announced: WalletOption[], win: Window & typeof globalThis): WalletOption[] => {
  const announcedNames = new Set(announced.map(({ name }) => name));
  return mergeOptions(announced, discoverLegacy(win).filter(({ name }) => !announcedNames.has(name)));
};

export function optionFromAnnouncement(detail: unknown): WalletOption | undefined {
  const value = detail as { info?: { uuid?: string; name?: string; rdns?: string }; provider?: Eip1193 };
  const name = supported(value.info?.name ?? '', value.info?.rdns ?? '');
  return name && value.info?.uuid && value.provider?.request ? { id: value.info.uuid, name, provider: value.provider } : undefined;
}

export const initialWallet: WalletState = { phase: 'DISCONNECTED', options: [] };

export function mergeOptions(current: WalletOption[], incoming: WalletOption[]): WalletOption[] {
  const result = [...current];
  for (const option of incoming) {
    const index = result.findIndex((item) => item.id === option.id || item.provider === option.provider);
    if (index >= 0) result[index] = option;
    else result.push(option);
  }
  return result;
}

export function bindProviderEvents(provider: Eip1193, listeners: Record<string, (...args: unknown[]) => void>): () => void {
  for (const [event, listener] of Object.entries(listeners)) provider.on?.(event, listener);
  return () => { for (const [event, listener] of Object.entries(listeners)) provider.removeListener?.(event, listener); };
}

export async function accountSessionAction(provider: Eip1193, accounts: unknown): Promise<WalletAction> {
  const account = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0].toLowerCase() as Address : undefined;
  if (!account) return { type: 'DISCONNECT' };
  const chain = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
  return chain === STUDIO_CHAIN ? { type: 'CONNECTED', account, chain } : { type: 'WRONG_CHAIN', chain };
}

export const canWrite = (state: WalletState): boolean => state.phase === 'CONNECTED' && state.chain?.toLowerCase() === STUDIO_CHAIN && Boolean(state.selected && state.account);

export function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'DISCOVERING': return { ...state, phase: 'DISCOVERING', error: undefined };
    case 'DISCOVER': return { ...state, phase: 'CHOOSER_OPEN', options: mergeOptions(state.options, action.options ?? []) };
    case 'ADD_OPTIONS': return { ...state, options: mergeOptions(state.options, action.options ?? []) };
    case 'CONNECTING': return { ...state, phase: 'CONNECTING', selected: action.option, error: undefined };
    case 'CONNECTED': return { ...state, phase: 'CONNECTED', account: action.account, chain: action.chain, error: undefined };
    case 'WRONG_CHAIN': return { ...state, phase: 'WRONG_CHAIN', chain: action.chain, error: 'Switch to GenLayer Studio Devnet to continue.' };
    case 'ERROR': return { ...state, phase: 'ERROR', error: action.error ?? 'Wallet connection failed.' };
    case 'DISCONNECT': return initialWallet;
    default: return state;
  }
}

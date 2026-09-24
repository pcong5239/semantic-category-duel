import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Calldata } from './contract';
import { contractAddress } from './config';
import { terminalTxPhase, type Game, type TxPhase } from './types';
import { accountSessionAction, availableWallets, bindProviderEvents, canWrite, initialWallet, optionFromAnnouncement, STUDIO_CHAIN, walletReducer, type WalletOption } from './wallet';
import { loadJournal, type JournalRecord } from './pending';

const short = (value?: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '';
const hasSubmittedHash = (error: unknown): error is { hash: string } => typeof error === 'object' && error !== null && typeof (error as { hash?: unknown }).hash === 'string';
const phaseCopy: Record<TxPhase, string> = {
  IDLE: 'Ready',
  WAITING_FOR_WALLET: 'Confirm this action in your wallet',
  SUBMITTED: 'Transaction submitted',
  WAITING_FOR_FINALITY: 'Validators are reaching finality',
  VERIFYING_EXECUTION: 'Finalized — verifying execution',
  VERIFYING_READBACK: 'Verifying authoritative game state',
  SUCCESS: 'Action verified',
  REJECTED: 'Wallet request rejected',
  FAILED: 'Transaction failed',
  RECONCILIATION_REQUIRED: 'Reconciliation required',
};

function WalletBrandIcon({ name }: { name: string }) {
  if (name === 'MetaMask') {
    return (
      <svg className="wallet-brand-svg" width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#e27625" d="m24 5 15 7-4 25-11 7-11-7-4-25 15-7Z" />
        <path fill="#f3b44d" d="m24 5-7 15 7 5 7-5-7-15Zm-11 7 4 8 7 5v4l-11-6-2-11Zm22 0-4 8-7 5v4l11-6 2-11Z" />
        <path fill="#d25b2b" d="m13 37 11 7V30l-7-4-4 11Zm22 0-11 7V30l7-4 4 11Z" />
        <path fill="#fff" d="m18 26 6 4 6-4-2-3-4 2-4-2-2 3Z" />
      </svg>
    );
  }
  if (name === 'OKX Wallet') {
    return (
      <svg className="wallet-brand-svg" width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
        <rect width="48" height="48" rx="8" fill="#11130f" />
        <rect x="8" y="8" width="13" height="13" fill="#fff" />
        <rect x="27" y="8" width="13" height="13" fill="#fff" />
        <rect x="17.5" y="17.5" width="13" height="13" fill="#fff" />
        <rect x="8" y="27" width="13" height="13" fill="#fff" />
        <rect x="27" y="27" width="13" height="13" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg className="wallet-brand-svg" width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="8" fill="#7c83ff" />
      <path fill="#fff" d="M14 19c-1-6 1-9 4-12l4 7c1-1 3-1 4 0l4-7c3 3 5 6 4 12 3 3 3 7 2 11-2 5-6 9-11 9s-9-4-11-9c-1-4-1-8 2-11Z" />
      <circle cx="19" cy="22" r="2" fill="#292f75" />
      <circle cx="29" cy="22" r="2" fill="#292f75" />
      <path d="M21 27h6c-1 3-2 3-3 3s-2 0-3-3Z" fill="#292f75" />
    </svg>
  );
}

export default function App() {
  const [wallet, dispatch] = useReducer(walletReducer, initialWallet);
  const [gameId, setGameId] = useState('');
  const [game, setGame] = useState<Game | null>(null);
  const [word, setWord] = useState('');
  const [txPhase, setTxPhase] = useState<TxPhase>('IDLE');
  const [txHash, setTxHash] = useState('');
  const [message, setMessage] = useState('');
  const [opponent, setOpponent] = useState('');
  const [category, setCategory] = useState('ANIMAL');
  const [letter, setLetter] = useState('a');
  const [copiedHash, setCopiedHash] = useState(false);
  const [pending, setPending] = useState<JournalRecord[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const announced = useRef<WalletOption[]>([]);
  const lifecycle = useRef(new AbortController());

  useEffect(() => {
    lifecycle.current = new AbortController();
    return () => lifecycle.current.abort(new Error('PAGE_UNMOUNTED'));
  }, []);

  useEffect(() => {
    if (!['SUCCESS', 'FAILED', 'REJECTED'].includes(txPhase)) return;
    const timer = window.setTimeout(() => {
      setTxPhase('IDLE');
      setTxHash('');
      setMessage('');
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [txPhase]);

  const refresh = async () => {
    if (!gameId) return;
    try {
      setGame(await (await import('./contract')).readGame(BigInt(gameId), lifecycle.current.signal));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read game.');
    }
  };

  useEffect(() => {
    const onAnnouncement = (event: Event) => {
      const option = optionFromAnnouncement((event as CustomEvent).detail);
      if (!option) return;
      announced.current = [...announced.current.filter((item) => item.id !== option.id && item.provider !== option.provider), option];
      dispatch({ type: 'ADD_OPTIONS', options: [option] });
    };
    window.addEventListener('eip6963:announceProvider', onAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', onAnnouncement);
  }, []);

  useEffect(() => {
    try {
      const records = loadJournal(localStorage).filter((item) => item.status === 'SUBMITTED' || item.status === 'RECONCILE');
      setPending(records);
      const latest = records.at(-1);
      if (latest?.tx_hash) { setTxHash(latest.tx_hash); setTxPhase('RECONCILIATION_REQUIRED'); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load the transaction journal.');
    }
  }, []);

  useEffect(() => {
    if (wallet.phase === 'CHOOSER_OPEN' && !dialog.current?.open) dialog.current?.showModal();
  }, [wallet.phase]);

  useEffect(() => {
    const provider = wallet.selected?.provider;
    if (!provider?.on) return;
    const applySession = async (accounts?: unknown) => {
      try {
        const current = accounts ?? await provider.request({ method: 'eth_accounts' });
        dispatch(await accountSessionAction(provider, current));
      } catch (error) {
        dispatch({ type: 'ERROR', error: error instanceof Error ? error.message : 'Wallet session refresh failed.' });
      }
    };
    const accountsChanged = (...values: unknown[]) => { void applySession(values[0]); };
    const chainChanged = () => { void applySession(); };
    const disconnected = () => dispatch({ type: 'DISCONNECT' });
    return bindProviderEvents(provider, { accountsChanged, chainChanged, disconnect: disconnected });
  }, [wallet.selected?.provider]);

  const openWallet = () => {
    dispatch({ type: 'DISCOVERING' });
    dispatch({ type: 'DISCOVER', options: availableWallets(announced.current, window) });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  };

  const connect = async (option: WalletOption) => {
    dispatch({ type: 'CONNECTING', option });
    try {
      const accounts = await option.provider.request({ method: 'eth_requestAccounts' }) as string[];
      const chain = await option.provider.request({ method: 'eth_chainId' }) as string;
      if (!accounts?.[0]) throw new Error('Wallet returned no account.');
      if (chain.toLowerCase() !== STUDIO_CHAIN) {
        try {
          await option.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: STUDIO_CHAIN }] });
        } catch (switchError) {
          if ((switchError as { code?: number }).code !== 4902) {
            dispatch({ type: 'WRONG_CHAIN', chain });
            return;
          }
          await option.provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: STUDIO_CHAIN, chainName: 'GenLayer Studio Devnet', rpcUrls: ['https://studio-dev.genlayer.com/api'], nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 } }] });
          await option.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: STUDIO_CHAIN }] });
        }
      }
      const currentAccounts = await option.provider.request({ method: 'eth_accounts' });
      const session = await accountSessionAction(option.provider, currentAccounts);
      dispatch(session);
      if (session.type !== 'CONNECTED') return;
      dialog.current?.close();
    } catch (error) {
      dispatch({ type: 'ERROR', error: error instanceof Error ? error.message : 'Wallet connection failed.' });
    }
  };

  const copyHash = async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      /* clipboard write failure handled silently */
    }
  };

  const actor = useMemo(() => {
    if (!game || !wallet.account) return 'OBSERVER';
    if (wallet.account.toLowerCase() === game.primary.toLowerCase()) return 'A';
    if (wallet.account.toLowerCase() === game.secondary.toLowerCase()) return 'B';
    return 'OBSERVER';
  }, [game, wallet.account]);

  const currentPlayer = (game?.domain.turn ?? 0) % 2 === 0 ? 'A' : 'B';
  const writesEnabled = canWrite(wallet);
  const canPlay = writesEnabled && game?.phase === 'TURN' && actor === currentPlayer;

  const transact = async (method: string, args: Calldata[]) => {
    if (!canWrite(wallet) || !wallet.selected || !wallet.account || !game) return;
    setMessage('');
    try {
      await (await import('./contract')).writeAndVerify({
        provider: wallet.selected.provider,
        account: wallet.account,
        method,
        args,
        id: BigInt(game.id),
        nextRevision: BigInt(game.revision) + 1n,
        signal: lifecycle.current.signal,
        onPhase: (phase, hash) => {
          setTxPhase(phase);
          if (hash) setTxHash(hash);
        },
      });
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Transaction failed.';
      setTxPhase(hasSubmittedHash(error) ? 'RECONCILIATION_REQUIRED' : text.toLowerCase().includes('reject') ? 'REJECTED' : 'FAILED');
      if (hasSubmittedHash(error)) setPending(loadJournal(localStorage).filter((item) => item.status === 'RECONCILE'));
      setMessage(text);
    }
  };

  const createGame = async () => {
    if (!canWrite(wallet) || !wallet.selected || !wallet.account || !/^0x[0-9a-fA-F]{40}$/.test(opponent)) return;
    try {
      const api = await import('./contract');
      const nonce = api.createNonce();
      const normalizedOpponent = api.normalizeAddress(opponent);
      const result = await api.writeAndVerify({
        provider: wallet.selected.provider,
        account: wallet.account,
        method: 'create_game',
        args: [nonce, normalizedOpponent, category, letter],
        signal: lifecycle.current.signal,
        onPhase: (phase, hash) => {
          setTxPhase(phase);
          if (hash) setTxHash(hash);
        },
      });
      const id = result.id ?? await api.idByNonce(wallet.account, nonce, lifecycle.current.signal);
      setGameId(String(id));
      setGame(await api.readGame(id, lifecycle.current.signal));
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Transaction failed.';
      setTxPhase(hasSubmittedHash(error) ? 'RECONCILIATION_REQUIRED' : text.toLowerCase().includes('reject') ? 'REJECTED' : 'FAILED');
      if (hasSubmittedHash(error)) setPending(loadJournal(localStorage).filter((item) => item.status === 'RECONCILE'));
      setMessage(text);
    }
  };

  const reconcile = async (record: JournalRecord) => {
    if (!canWrite(wallet)) return;
    setTxHash(record.tx_hash);
    setTxPhase('WAITING_FOR_FINALITY');
    setMessage('');
    try {
      const api = await import('./contract');
      const id = await api.reconcileWrite(record, lifecycle.current.signal, setTxPhase);
      setPending(loadJournal(localStorage).filter((item) => item.status === 'SUBMITTED' || item.status === 'RECONCILE'));
      setTxPhase('SUCCESS');
      if (id) { setGameId(String(id)); setGame(await api.readGame(id, lifecycle.current.signal)); }
    } catch (error) {
      const records = loadJournal(localStorage).filter((item) => item.status === 'SUBMITTED' || item.status === 'RECONCILE');
      setPending(records);
      setTxPhase(records.some((item) => item.reservation === record.reservation) ? 'RECONCILIATION_REQUIRED' : 'FAILED');
      setMessage(error instanceof Error ? error.message : 'Reconciliation is not complete yet.');
    }
  };

  const dismissTransaction = () => {
    setTxPhase('IDLE');
    setTxHash('');
    setMessage('');
  };

  return (
    <div className="shell">
      <header className="header">
        <a className="brand" href="#top" aria-label="Semantic Category Duel home">
          <span className="brand-crest" aria-hidden="true">
            <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
              <rect width="36" height="36" rx="8" fill="#151912" stroke="#d8ff3e" strokeWidth="1.5" />
              <path d="M14 13c-2.5 0-4.5 1.5-4.5 3.8 0 2.6 2.2 3.3 4.4 4 2.2.6 3.1 1.2 3.1 2.3 0 1.1-1 2-2.6 2-1.8 0-3-.9-3.5-2l-2 1.2c.9 1.8 2.9 3 5.5 3 3.2 0 5.2-2 5.2-4.4 0-2.8-2.4-3.5-4.5-4.1-2.1-.6-3-1.1-3-2.1 0-1 .9-1.8 2.3-1.8 1.4 0 2.4.6 3 1.5l1.9-1.4c-1.1-1.4-2.8-2.1-4.8-2.1Z" fill="#d8ff3e" />
              <path d="M26 14c-1.1-1.1-2.6-1.8-4.5-1.8-3.9 0-6.6 2.9-6.6 7s2.7 7 6.6 7c1.9 0 3.4-.7 4.5-1.8l-1.6-1.8c-.8.8-1.8 1.2-2.9 1.2-2.5 0-4.1-1.9-4.1-4.7s1.6-4.7 4.1-4.7c1.1 0 2.1.4 2.9 1.2l1.6-1.6Z" fill="#f4f6ef" />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-title">Semantic Category Duel</span>
            <span className="brand-sub">Consensus Referee</span>
          </span>
        </a>

        <nav className="nav" aria-label="Primary navigation">
          <a href="#arena">Arena</a>
          <a href="#how">How it works</a>
        </nav>

        <div className="header-meta">
          <span className="network-badge" title="Target Network: GenLayer Studio Devnet">
            <span className="network-dot" aria-hidden="true" />
            Studio Devnet
          </span>
          {wallet.phase === 'CONNECTED' ? (
            <button
              className="wallet connected"
              onClick={() => dispatch({ type: 'DISCONNECT' })}
              aria-label={`${wallet.selected?.name} connected as ${wallet.account}. Disconnect wallet`}
              title="Click to disconnect wallet"
            >
              <span className="wallet-dot" aria-hidden="true" />
              <span className="wallet-name">{wallet.selected?.name}</span>
              <span className="wallet-sep">·</span>
              <span className="wallet-addr">{short(wallet.account)}</span>
              <span className="wallet-action-hint">Disconnect</span>
            </button>
          ) : (
            <button className="wallet" onClick={openWallet}>
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">Six turns · Two minds · One neutral referee</p>
            <h1>
              Words chain.<br />
              <em>Meaning decides.</em>
            </h1>
            <p className="hero-desc">
              Challenge another wallet to a public category duel. GenLayer validators judge the words; the contract alone enforces turns, links and score.
            </p>
            <div className="hero-cta-row">
              <a className="cta" href="#arena">
                Enter the arena ↓
              </a>
              <a className="cta-secondary" href="#how">
                Protocol specification →
              </a>
            </div>
            <div className="hero-spec-strip" aria-label="Game mechanics summary">
              <div className="spec-item">
                <span className="spec-label">Turn Horizon</span>
                <strong className="spec-val">6 Alternate Turns</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Chain Constraint</span>
                <strong className="spec-val">Last Letter to First</strong>
              </div>
              <div className="spec-item">
                <span className="spec-label">Arbitration</span>
                <strong className="spec-val">GenLayer Consensus</strong>
              </div>
            </div>
          </div>
          <div className="hero-backdrop" aria-hidden="true">
            <span className="hero-mark">A → Z</span>
          </div>
        </section>

        <section id="arena" className="arena">
          <div className="arena-header">
            <p className="eyebrow">Live contract arena</p>
            <h2>The Duel Arena</h2>
            <p className="arena-subtitle">
              Create a new 6-turn challenge or inspect an on-chain duel by ID.
            </p>
          </div>

          {!contractAddress && (
            <div className="notice" role="status">
              <span className="notice-icon" aria-hidden="true">ℹ</span>
              <div>
                <b>Contract address required</b>
                <p>Contract address is not configured for this build.</p>
              </div>
            </div>
          )}

          <div className="arena-panels-grid">
            <div className="card create-card">
              <div className="card-head">
                <span className="card-badge">Step 1</span>
                <h3>Initiate New Duel</h3>
                <p>Player A nominates an opponent wallet, category, and initial starting letter.</p>
              </div>
              <form className="create" onSubmit={(e) => { e.preventDefault(); void createGame(); }}>
                <label className="field-label">
                  <span>Opponent address</span>
                  <input
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value.trim())}
                    placeholder="0x… (Player B wallet address)"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <small className="field-hint">Must be a valid 42-character 0x EVM address.</small>
                </label>

                <div className="form-row-duo">
                  <label className="field-label">
                    <span>Category</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="ANIMAL">ANIMAL</option>
                      <option value="PLANT">PLANT</option>
                      <option value="FOOD">FOOD</option>
                      <option value="TOOL">TOOL</option>
                    </select>
                    <small className="field-hint">Common English nouns.</small>
                  </label>

                  <label className="field-label letter-label">
                    <span>Initial letter</span>
                    <div className="letter-input-box">
                      <input
                        value={letter}
                        maxLength={1}
                        onChange={(e) => setLetter(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
                        placeholder="a"
                        spellCheck={false}
                        autoComplete="off"
                      />
                      <span className="letter-preview" aria-hidden="true">
                        {letter.toUpperCase() || '—'}
                      </span>
                    </div>
                    <small className="field-hint">Single letter [a-z].</small>
                  </label>
                </div>

                <button
                  type="submit"
                  className="btn-create"
                  disabled={!writesEnabled || !contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(opponent)}
                >
                  Create game
                </button>
                {wallet.phase !== 'CONNECTED' && (
                  <p className="form-notice">Connect wallet above to initiate on-chain duels.</p>
                )}
              </form>
            </div>

            <div className="card inspect-card">
              <div className="card-head">
                <span className="card-badge">Step 2</span>
                <h3>Inspect a game</h3>
                <p>Load an on-chain game ID to inspect its exact current state and history.</p>
              </div>
              <form className="inspect-form" onSubmit={(e) => { e.preventDefault(); void refresh(); }}>
                <label className="field-label">
                  <span>Game ID</span>
                  <div className="inspect-input-row">
                    <input
                      value={gameId}
                      onChange={(e) => setGameId(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      placeholder="e.g. 1"
                      spellCheck={false}
                    />
                    <button type="submit" className="btn-load">Load game</button>
                  </div>
                  <small className="field-hint">Query on-chain record via contract get_case.</small>
                </label>
              </form>

              {game && (
                <div className="quick-summary">
                  <div className="summary-stat">
                    <span>Category</span>
                    <b>{game.base.category}</b>
                  </div>
                  <div className="summary-stat">
                    <span>Phase</span>
                    <b>{game.phase}</b>
                  </div>
                  <div className="summary-stat">
                    <span>Turn</span>
                    <b>{Math.min(game.domain.turn + 1, 6)} / 6</b>
                  </div>
                </div>
              )}
            </div>
          </div>

          {game ? (
            <div className="board">
              <aside className="board-sidebar">
                <div className="sidebar-pill-row">
                  <div className="category-pill">{game.base.category}</div>
                  <div className="phase-pill" data-phase={game.phase}>{game.phase}</div>
                </div>

                <div className="chain-cue">
                  <span className="cue-label">Next word starts with</span>
                  <span className="cue-letter">{game.domain.last_letter.toUpperCase()}</span>
                </div>

                <div className="scores-card">
                  <div className="score-block player-a">
                    <span className="score-label">
                      Player A {actor === 'A' && <span className="tag-you">YOU</span>}
                    </span>
                    <b className="score-num">{game.domain.score_a}</b>
                    <small className="score-addr">{short(game.primary)}</small>
                  </div>
                  <div className="score-divider">:</div>
                  <div className="score-block player-b">
                    <span className="score-label">
                      Player B {actor === 'B' && <span className="tag-you">YOU</span>}
                    </span>
                    <b className="score-num">{game.domain.score_b}</b>
                    <small className="score-addr">{short(game.secondary)}</small>
                  </div>
                </div>

                <div className="meta-footer">
                  <p>Turn {Math.min(game.domain.turn + 1, 6)} of 6 · {game.phase}</p>
                  <small className="actor-status">
                    {actor === 'A' && 'Your role: Player A (Creator)'}
                    {actor === 'B' && 'Your role: Player B (Challenger)'}
                    {actor === 'OBSERVER' && 'Observer mode: read-only viewer'}
                  </small>
                </div>
              </aside>

              <div className="play">
                <div className="play-header">
                  <span className="play-turn-tag">
                    {game.phase === 'DONE' ? 'Final Duel Result' : `Turn ${Math.min(game.domain.turn + 1, 6)} Active`}
                  </span>
                  <p className="turn">
                    {game.phase === 'DONE'
                      ? game.outcome.replace('_', ' ')
                      : `Player ${currentPlayer}'s move`}
                  </p>
                </div>

                <div className="play-input-section">
                  <label className="field-label">
                    <span>Your word</span>
                    <input
                      className="word-input"
                      value={word}
                      onChange={(e) => setWord(e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 24))}
                      disabled={!canPlay}
                      placeholder={canPlay ? `Word starting with '${game.domain.last_letter.toUpperCase()}'…` : 'Awaiting turn…'}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </label>
                  {canPlay && (
                    <div className="word-validation-cue">
                      {word.length > 0 ? (
                        word[0] !== game.domain.last_letter ? (
                          <span className="val-warn">Starts with &apos;{word[0]}&apos; instead of &apos;{game.domain.last_letter}&apos; (BAD_LINK: 0 pts)</span>
                        ) : game.domain.used.includes(word) ? (
                          <span className="val-warn">Word already used in this duel (REPEATED: 0 pts)</span>
                        ) : (
                          <span className="val-valid">Chains with &apos;{game.domain.last_letter}&apos; · Ready for validator adjudication</span>
                        )
                      ) : (
                        <span className="val-hint">Must start with &apos;{game.domain.last_letter}&apos; · 2–24 lowercase English letters [a-z].</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="actions">
                  {game.phase === 'INVITED' && actor === 'B' && (
                    <button
                      className="btn-action primary"
                      disabled={!writesEnabled}
                      onClick={() => void transact('join_game', [BigInt(game.id), BigInt(game.revision)])}
                    >
                      Join game
                    </button>
                  )}
                  <button
                    className="btn-action primary"
                    disabled={!writesEnabled || !canPlay || word.length < 2}
                    onClick={() => void transact('play_word', [BigInt(game.id), word, BigInt(game.domain.turn), BigInt(game.revision)])}
                  >
                    Play word
                  </button>
                  <button
                    disabled={!writesEnabled || !canPlay}
                    className="btn-action quiet"
                    onClick={() => void transact('pass_turn', [BigInt(game.id), BigInt(game.domain.turn), BigInt(game.revision)])}
                  >
                    Pass
                  </button>
                  {game.phase === 'FROZEN' && (
                    <button
                      className="btn-action evaluate"
                      disabled={!writesEnabled}
                      onClick={() => void transact('evaluate_move', [BigInt(game.id), BigInt(game.revision)])}
                    >
                      Evaluate
                    </button>
                  )}
                  {game.phase === 'UNRESOLVED' && (
                    <button
                      className="btn-action retry"
                      disabled={!writesEnabled}
                      onClick={() => void transact('retry_move', [BigInt(game.id), BigInt(game.revision)])}
                    >
                      Retry
                    </button>
                  )}
                  {game.phase !== 'DONE' && actor !== 'OBSERVER' && (
                    <button
                      className="btn-action danger quiet"
                      disabled={!writesEnabled}
                      onClick={() => void transact('resign_game', [BigInt(game.id), BigInt(game.revision)])}
                    >
                      Resign
                    </button>
                  )}
                </div>

                <div className="ledger-section">
                  <div className="ledger-header">
                    <h4>Move Ledger</h4>
                    <span className="ledger-counter">6 Turns Scheduled</span>
                  </div>
                  <ol className="ledger">
                    {[0, 1, 2, 3, 4, 5].map((turn) => {
                      const move = game.domain.moves[turn];
                      const turnPlayer = turn % 2 === 0 ? 'Player A' : 'Player B';
                      return (
                        <li key={turn} className={`ledger-row ${move ? 'has-move' : 'pending-move'}`}>
                          <span className="turn-number">{turn + 1}</span>
                          <span className="turn-player">{turnPlayer}</span>
                          <b className="turn-word">{move?.word || '—'}</b>
                          <span className="turn-result" data-result={move?.result || 'Waiting'}>
                            {move?.result || 'Waiting'}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">
              <span className="empty-glyph" aria-hidden="true">A → ?</span>
              <h3>No game loaded</h3>
              <p>Enter an on-chain game ID above to inspect its exact current state and history, or create a new challenge.</p>
            </div>
          )}

          {txPhase !== 'IDLE' && (
            <div
              className={`transaction ${txPhase}`}
              data-transaction-phase={txPhase}
              role={txPhase === 'FAILED' ? 'alert' : 'status'}
              aria-live="polite"
            >
              <button type="button" className="tx-dismiss" onClick={dismissTransaction} aria-label="Dismiss transaction status">×</button>
              <span className={terminalTxPhase(txPhase) ? 'stop' : 'spinner'} aria-hidden="true">
                {txPhase === 'SUCCESS' && '✓'}
                {['FAILED', 'REJECTED', 'RECONCILIATION_REQUIRED'].includes(txPhase) && '!'}
              </span>
              <div className="tx-details">
                <span className="tx-phase-label">{txPhase.replace(/_/g, ' ')}</span>
                <b>{phaseCopy[txPhase]}</b>
                {txHash && (
                  <div className="tx-hash-row">
                    <code>{short(txHash)}</code>
                    <button
                      type="button"
                      className="tx-copy-btn"
                      onClick={copyHash}
                      aria-label="Copy transaction hash"
                    >
                      {copiedHash ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
                {pending.map((record) => (
                  <button key={record.reservation} type="button" className="tx-copy-btn" disabled={!writesEnabled} onClick={() => void reconcile(record)}>
                    Reconcile {short(record.tx_hash)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {message && <p className="error" role="alert">{message}</p>}
        </section>

        <section id="how" className="how">
          <div className="how-header">
            <p className="eyebrow">Protocol, not promises</p>
            <h2>How a duel works</h2>
            <p className="how-subtitle">
              A public six-turn word-chain game governed by deterministic contract rules and decentralized AI semantic evaluation.
            </p>
          </div>
          <div className="steps">
            <article className="step-card">
              <span className="step-index">01</span>
              <h3>Invite</h3>
              <p>Player A chooses a category and starting letter, then nominates Player B on-chain.</p>
            </article>
            <article className="step-card">
              <span className="step-index">02</span>
              <h3>Chain</h3>
              <p>Players alternate public words. Each valid word must begin with the previous word’s final letter.</p>
            </article>
            <article className="step-card">
              <span className="step-index">03</span>
              <h3>Adjudicate</h3>
              <p>Independent GenLayer validators classify category membership. Unknown judgments award nothing.</p>
            </article>
            <article className="step-card">
              <span className="step-index">04</span>
              <h3>Verify</h3>
              <p>After six turns, anyone can replay the immutable move ledger and score from contract history.</p>
            </article>
          </div>

          <div className="protocol-matrix">
            <div className="matrix-col">
              <h4>Deterministic Contract Authority</h4>
              <ul>
                <li>Turn rotation: strictly alternates between Player A and Player B.</li>
                <li>Link enforcement: must start with last letter of previous word.</li>
                <li>Duplicate prevention: words cannot be repeated within a match.</li>
                <li>Score bookkeeping: 1 point per accepted semantic move; 6 turns total.</li>
              </ul>
            </div>
            <div className="matrix-col">
              <h4>GenLayer Validator Consensus</h4>
              <ul>
                <li>Semantic classification: verifies membership in ANIMAL, PLANT, FOOD, or TOOL.</li>
                <li>Non-deterministic consensus: validators run independent LLM evaluations.</li>
                <li>Equivalence comparison: stable decision schema prevents subjective bias.</li>
                <li>Unknown handling: genuine ambiguity yields UNKNOWN with bounded retries.</li>
              </ul>
            </div>
          </div>

          <p className="fine">
            Game score from accepted word-category judgments; no rewards or verified real-world achievement. All submitted text is public and permanent. Do not include private information, credentials or personal records.
          </p>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-logo">SC</span>
            <div>
              <b>Semantic Category Duel</b>
              <p>On-chain semantic word-chain game adjudicated by GenLayer validators.</p>
            </div>
          </div>
          <div className="footer-links">
            <a href="#arena">Arena</a>
            <a href="#how">How It Works</a>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
      </footer>

      <dialog
        ref={dialog}
        className="wallet-dialog"
        onClose={() => wallet.phase !== 'CONNECTED' && dispatch({ type: 'DISCONNECT' })}
        aria-labelledby="wallet-modal-title"
      >
        <div className="dialog-header">
          <div>
            <p className="eyebrow" id="wallet-modal-eyebrow">Detected wallets</p>
            <h2 id="wallet-modal-title">Choose your wallet</h2>
          </div>
          <button className="close" onClick={() => dialog.current?.close()} aria-label="Close wallet selector">
            ×
          </button>
        </div>

        {wallet.options.length ? (
          <div className="wallet-options-group">
            {wallet.options.map((option) => (
              <button
                className="wallet-option"
                key={option.id}
                onClick={() => void connect(option)}
              >
                <div className="wallet-option-info">
                  <WalletBrandIcon name={option.name} />
                  <span className="wallet-option-name">{option.name}</span>
                </div>
                <span className="wallet-connect-tag">Connect →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="notice">
            No supported wallet detected. Install MetaMask, OKX Wallet or Rabby, then reopen this selector.
          </p>
        )}

        {wallet.phase === 'WRONG_CHAIN' && (
          <p className="error" role="alert">
            {wallet.error || 'Switch to GenLayer Studio Devnet to continue.'}
          </p>
        )}
        {wallet.phase === 'ERROR' && wallet.error && (
          <p className="error" role="alert">
            {wallet.error}
          </p>
        )}
      </dialog>
    </div>
  );
}

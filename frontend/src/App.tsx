import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { contractAddress, idByNonce, readGame, type Calldata, type TxPhase, writeAndVerify } from './contract';
import type { Address, Game } from './types';
import { discoverLegacy, initialWallet, optionFromAnnouncement, walletReducer, type WalletOption } from './wallet';

const short = (value?: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '';
const phaseCopy: Record<TxPhase, string> = {
  IDLE: 'Ready', WAITING_FOR_WALLET: 'Confirm this action in your wallet', SUBMITTED: 'Transaction submitted',
  WAITING_FOR_FINALITY: 'Validators are reaching finality', VERIFYING_EXECUTION: 'Finalized — verifying execution',
  VERIFYING_READBACK: 'Verifying authoritative game state', SUCCESS: 'Action verified', REJECTED: 'Wallet request rejected',
  FAILED: 'Transaction failed', RECONCILIATION_REQUIRED: 'Reconciliation required',
};

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
  const dialog = useRef<HTMLDialogElement>(null);

  const refresh = async () => {
    if (!gameId) return;
    try { setGame(await readGame(BigInt(gameId))); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to read game.'); }
  };

  useEffect(() => {
    const onAnnouncement = (event: Event) => {
      const option = optionFromAnnouncement((event as CustomEvent).detail);
      if (!option) return;
      const options = [...wallet.options.filter((item) => item.name !== option.name), option];
      if (wallet.phase === 'CHOOSER_OPEN') dispatch({ type: 'DISCOVER', options });
    };
    window.addEventListener('eip6963:announceProvider', onAnnouncement);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', onAnnouncement);
  }, [wallet.options, wallet.phase]);

  const openWallet = () => {
    dispatch({ type: 'DISCOVER', options: discoverLegacy(window) });
    dialog.current?.showModal();
  };

  const connect = async (option: WalletOption) => {
    dispatch({ type: 'CONNECTING', option });
    try {
      const accounts = await option.provider.request({ method: 'eth_requestAccounts' }) as string[];
      const chain = await option.provider.request({ method: 'eth_chainId' }) as string;
      if (!accounts?.[0]) throw new Error('Wallet returned no account.');
      if (chain.toLowerCase() !== '0xf22f') { dispatch({ type: 'WRONG_CHAIN', chain }); return; }
      dispatch({ type: 'CONNECTED', account: accounts[0].toLowerCase() as Address, chain });
      dialog.current?.close();
    } catch (error) {
      dispatch({ type: 'ERROR', error: error instanceof Error ? error.message : 'Wallet connection failed.' });
    }
  };

  const actor = useMemo(() => {
    if (!game || !wallet.account) return 'OBSERVER';
    if (wallet.account === game.primary) return 'A';
    if (wallet.account === game.secondary) return 'B';
    return 'OBSERVER';
  }, [game, wallet.account]);

  const currentPlayer = (game?.domain.turn ?? 0) % 2 === 0 ? 'A' : 'B';
  const canPlay = game?.phase === 'TURN' && actor === currentPlayer;

  const transact = async (method: string, args: Calldata[]) => {
    if (!wallet.selected || !wallet.account || !game) return;
    setMessage('');
    try {
      await writeAndVerify({ provider: wallet.selected.provider, account: wallet.account, method, args,
        id: BigInt(game.id), nextRevision: BigInt(game.revision) + 1n,
        onPhase: (phase, hash) => { setTxPhase(phase); if (hash) setTxHash(hash); },
      });
      await refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Transaction failed.';
      setTxPhase(txHash ? 'RECONCILIATION_REQUIRED' : text.toLowerCase().includes('reject') ? 'REJECTED' : 'FAILED');
      setMessage(text);
    }
  };

  const createGame = async () => {
    if (!wallet.selected || !wallet.account || !/^0x[0-9a-fA-F]{40}$/.test(opponent)) return;
    const nonce = crypto.randomUUID();
    try {
      await writeAndVerify({ provider: wallet.selected.provider, account: wallet.account, method: 'create_game', args: [nonce, opponent, category, letter], onPhase: (phase, hash) => { setTxPhase(phase); if (hash) setTxHash(hash); } });
      const id = await idByNonce(wallet.account, nonce);
      setGameId(String(id)); setGame(await readGame(id));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Transaction failed.'); }
  };

  return <div className="shell">
    <header><a className="brand" href="#top" aria-label="Semantic Category Duel home"><span aria-hidden>SC</span> Semantic Category Duel</a>
      <nav><a href="#arena">Arena</a><a href="#how">How it works</a></nav>
      {wallet.phase === 'CONNECTED' ? <button className="wallet connected" onClick={() => dispatch({ type: 'DISCONNECT' })}>{wallet.selected?.name} · {short(wallet.account)} · Disconnect</button> : <button className="wallet" onClick={openWallet}>Connect wallet</button>}
    </header>
    <main id="top">
      <section className="hero"><p className="eyebrow">Six turns. Two minds. One neutral referee.</p><h1>Words chain.<br/><em>Meaning decides.</em></h1><p>Challenge another wallet to a public category duel. GenLayer validators judge the words; the contract alone enforces turns, links and score.</p><a className="cta" href="#arena">Enter the arena ↓</a></section>
      <section id="arena" className="arena">
        <form className="create" onSubmit={(e) => { e.preventDefault(); void createGame(); }}><label>Opponent address<input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="0x…"/></label><label>Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>ANIMAL</option><option>PLANT</option><option>FOOD</option><option>TOOL</option></select></label><label>Letter<input value={letter} maxLength={1} onChange={(e) => setLetter(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}/></label><button disabled={wallet.phase !== 'CONNECTED' || !contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(opponent)}>Create game</button></form>
        <div className="arena-head"><div><p className="eyebrow">Live contract arena</p><h2>Inspect a game</h2></div><form onSubmit={(e) => { e.preventDefault(); void refresh(); }}><label>Game ID<input value={gameId} onChange={(e) => setGameId(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="1"/></label><button>Load game</button></form></div>
        {!contractAddress && <p className="notice">Contract deployment address will be configured after PRE_DEPLOY approval and Studio deployment.</p>}
        {game ? <div className="board">
          <aside><div className="category">{game.base.category}</div><p>Chain with <strong>{game.domain.last_letter.toUpperCase()}</strong></p><div className="scores"><span>Player A<b>{game.domain.score_a}</b></span><i>:</i><span>Player B<b>{game.domain.score_b}</b></span></div><p>Turn {Math.min(game.domain.turn + 1, 6)} of 6 · {game.phase}</p></aside>
          <div className="play"><p className="turn">{game.phase === 'DONE' ? game.outcome.replace('_', ' ') : `Player ${currentPlayer}'s move`}</p><label>Your word<input value={word} onChange={(e) => setWord(e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 24))} disabled={!canPlay}/></label><div className="actions">{game.phase === 'INVITED' && actor === 'B' && <button onClick={() => void transact('join_game', [BigInt(game.id), BigInt(game.revision)])}>Join game</button>}<button disabled={!canPlay || word.length < 2} onClick={() => void transact('play_word', [BigInt(game.id), word, BigInt(game.domain.turn), BigInt(game.revision)])}>Play word</button><button disabled={!canPlay} className="quiet" onClick={() => void transact('pass_turn', [BigInt(game.id), BigInt(game.domain.turn), BigInt(game.revision)])}>Pass</button>{game.phase === 'FROZEN' && <button onClick={() => void transact('evaluate_move', [BigInt(game.id), BigInt(game.revision)])}>Evaluate</button>}{game.phase === 'UNRESOLVED' && <button onClick={() => void transact('retry_move', [BigInt(game.id), BigInt(game.revision)])}>Retry</button>}{game.phase !== 'DONE' && actor !== 'OBSERVER' && <button className="quiet" onClick={() => void transact('resign_game', [BigInt(game.id), BigInt(game.revision)])}>Resign</button>}</div>
            <ol className="ledger">{[0,1,2,3,4,5].map((turn) => { const move = game.domain.moves[turn]; return <li key={turn}><span>{turn + 1}</span><b>{move?.word || '—'}</b><small>{move?.result || 'Waiting'}</small></li>; })}</ol>
          </div>
        </div> : <div className="empty"><span>A → ?</span><h3>No game loaded</h3><p>Enter an on-chain game ID to inspect its exact current state and history.</p></div>}
        {txPhase !== 'IDLE' && <div className={`transaction ${txPhase}`} data-transaction-phase={txPhase} role={txPhase === 'FAILED' ? 'alert' : 'status'} aria-live="polite"><span className={['SUCCESS','REJECTED','FAILED'].includes(txPhase) ? 'stop' : 'spinner'} aria-hidden/><div><b>{phaseCopy[txPhase]}</b>{txHash && <code>{short(txHash)}</code>}</div></div>}
        {message && <p className="error" role="alert">{message}</p>}
      </section>
      <section id="how" className="how"><p className="eyebrow">Protocol, not promises</p><h2>How a duel works</h2><div className="steps"><article><b>01</b><h3>Invite</h3><p>Player A chooses a category and starting letter, then nominates Player B.</p></article><article><b>02</b><h3>Chain</h3><p>Players alternate public words. Each valid word must begin with the previous word’s final letter.</p></article><article><b>03</b><h3>Adjudicate</h3><p>Independent GenLayer validators classify category membership. Unknown judgments award nothing.</p></article><article><b>04</b><h3>Verify</h3><p>After six turns, anyone can replay the immutable move ledger and score from contract history.</p></article></div><p className="fine">Game score from accepted word-category judgments; no rewards or verified real-world achievement. All submitted text is public and permanent. Do not include private information, credentials or personal records.</p></section>
    </main>
    <dialog ref={dialog} onClose={() => wallet.phase !== 'CONNECTED' && dispatch({ type: 'DISCONNECT' })}><button className="close" onClick={() => dialog.current?.close()} aria-label="Close wallet selector">×</button><p className="eyebrow">Detected wallets</p><h2>Choose your wallet</h2>{wallet.options.length ? wallet.options.map((option) => <button className="wallet-option" key={option.id} onClick={() => void connect(option)}>{option.name}<span>Connect →</span></button>) : <p className="notice">No supported wallet detected. Install MetaMask, OKX Wallet or Rabby, then reopen this selector.</p>}</dialog>
  </div>;
}

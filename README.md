# Semantic Category Duel

Semantic Category Duel is a two-player, six-turn word-chain game on GenLayer. Deterministic contract rules enforce turns, links, replay protection and scoring, while GenLayer validators independently classify whether a submitted word belongs to the chosen category.

## Verified release

- [Live application](https://semantic-category-duel.vercel.app)
- [Studio Next contract](https://explorer-studio-dev.genlayer.com/address/0x1C6Ce54fA8Fd3A99bf59c8823252Ac5bd0d5bEf1)
- [Deployment and recovery details](DEPLOYMENT.md)
- [Verification record](VERIFICATION.md)

## Trust problem and why GenLayer

Neither player should control whether a word belongs to a category, and a conventional contract cannot reliably decide an open-ended semantic question such as whether “tiger” is an animal. The contract sends that narrow classification question to independent GenLayer validators. Their equivalence-based consensus produces an on-chain result, while deterministic contract code alone enforces identity, turn order, word linking, duplicate detection, retry limits, score changes and the winner. A frontend or player cannot award a point by changing local state.

## How it works

1. Player A creates a game with an opponent, category and starting letter.
2. Player B joins from the invited wallet.
3. Players alternate words. Each word must begin with the previous word's final letter and cannot repeat an accepted word.
4. Validators classify category membership. A valid category match scores one point; an out-of-category word advances play without a point.
5. Unknown semantic results enter a bounded retry flow. After three accepted attempts, the player can pass without silently inventing a verdict.
6. The higher score after six turns wins. Either player may also resign.

Every write is shown through wallet confirmation, submission, finality, execution and authoritative readback. A durable local journal preserves submitted hashes for reconciliation and never automatically resubmits a transaction.

## Architecture and source of truth

- `contracts/main.py` is the authoritative game state machine and semantic adjudication boundary.
- `frontend/` is a static Vite/React client. It discovers injected wallets, displays contract state and submits explicit user actions; it has no privileged backend.
- GenLayer Studio Devnet is the source of truth for games, revisions, moves, scores and transaction outcomes. Browser storage contains only a bounded pending-transaction journal and short-lived read caches.

The main write methods are `create_game`, `join_game`, `play_word`, `evaluate_move`, `retry_move`, `pass_turn` and `resign_game`. Read methods expose the current case, immutable historical revisions, nonce-to-case identity and bounded indexes. Each accepted write records method, caller and argument identity in the next historical revision so the client can verify the exact operation it submitted.

## Transaction lifecycle

1. The client reserves one local journal entry before opening the wallet.
2. The user signs or rejects the single requested transaction.
3. A submitted hash is stored immutably and is never automatically resubmitted.
4. The client waits for GenLayer finality and checks semantic execution success.
5. It reads the expected historical revision and verifies method, caller and arguments.
6. If observation is interrupted after submission, **Resume verification** checks the retained hash; it sends no new transaction.

Wrong-chain, wrong-account, stale-revision, rejected-signature, execution and readback errors remain visible and do not produce optimistic success.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cd frontend
npm ci
npm run dev
```

Set `VITE_CONTRACT_ADDRESS=0x1C6Ce54fA8Fd3A99bf59c8823252Ac5bd0d5bEf1` before starting the frontend.

## Verify

```bash
cd frontend
npm test
npm run build
```

The contract test suite uses the official GenLayer Testing Suite:

```bash
python -m pip install -r requirements-test.txt
python -m pytest -q tests/test_contract.py
```

On Windows, run the Python suite inside WSL/Linux. Native Windows stdin is not a GenVM calldata stream and can make the direct loader fail before tests execute; the reviewed WSL run passes all `21` contract/runtime tests.

Current reviewed results: frontend `5` files / `37` tests pass; the production build transforms `470` modules; the exact contract source passes `21` contract/runtime tests under WSL/Linux. Reproduce the release claims and live proof matrix from [VERIFICATION.md](VERIFICATION.md).

## Network and wallets

- Network: GenLayer Studio Devnet (chain ID `61997`)
- Supported injected wallets: MetaMask, Rabby and OKX Wallet
- Live contract: [`0x1C6C…bEf1`](https://explorer-studio-dev.genlayer.com/address/0x1C6Ce54fA8Fd3A99bf59c8823252Ac5bd0d5bEf1)
- Deployment details: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- Contract source: `contracts/main.py`

The frontend starts disconnected, lists only wallets actually announced or detected in the browser, and binds writes to the selected provider and account.

## Security and trust boundaries

- Wallet keys and signatures stay in the selected injected provider; this repository contains no key or seed material.
- The selected account and chain are revalidated after connection and provider events; writes require Studio Devnet chain `0xf22d`.
- Contract arguments include expected revision/turn values to reject stale or out-of-turn actions.
- The client verifies finalized execution and an authoritative historical readback before showing success.
- The intentionally frozen contract has no upgrader. A defect requires a separately reviewed replacement deployment.

## Known limitations

- Studio Devnet can reset; a reset requires redeployment and a new evidence cycle.
- Semantic classification is nondeterministic consensus. An `UNKNOWN` result can require a bounded retry and may still end in a pass.
- Pending-hash recovery depends on the same browser profile retaining its local journal; users should also retain submitted hashes externally.
- The client supports injected MetaMask, Rabby and OKX Wallet providers; it does not include WalletConnect or a custodial wallet.

# Semantic Category Duel

Semantic Category Duel is a two-player, six-turn word-chain game on GenLayer. Deterministic contract rules enforce turns, links, replay protection and scoring, while GenLayer validators independently classify whether a submitted word belongs to the chosen category.

## How it works

1. Player A creates a game with an opponent, category and starting letter.
2. Player B joins from the invited wallet.
3. Players alternate words. Each word must begin with the previous word's final letter and cannot repeat an accepted word.
4. Validators classify category membership. A valid category match scores one point; an out-of-category word advances play without a point.
5. Unknown semantic results enter a bounded retry flow. After three accepted attempts, the player can pass without silently inventing a verdict.
6. The higher score after six turns wins. Either player may also resign.

Every write is shown through wallet confirmation, submission, finality, execution and authoritative readback. A durable local journal preserves submitted hashes for reconciliation and never automatically resubmits a transaction.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cd frontend
npm ci
npm run dev
```

Set `VITE_CONTRACT_ADDRESS` to the deployed Studio Devnet contract address before starting the frontend.

## Verify

```bash
cd frontend
npm test
npm run build
```

The contract test suite uses the official GenLayer Testing Suite:

```bash
python -m pytest -q tests/test_contract.py
```

## Network and wallets

- Network: GenLayer Studio Devnet (chain ID `61997`)
- Supported injected wallets: MetaMask, Rabby and OKX Wallet
- Contract: `contracts/main.py`

The frontend starts disconnected, lists only wallets actually announced or detected in the browser, and binds writes to the selected provider and account.

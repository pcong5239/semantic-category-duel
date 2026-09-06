# Semantic Category Duel — Implementation Plan

## Locked baseline

Implement candidate C10 from the exact R12 Research handoff without changing product scope: one six-turn, two-wallet word-chain game; deterministic authority, turn, link, repeat, scoring, pass, resign, history and capacity logic; GenLayer consensus only for otherwise-valid word/category membership; `UNKNOWN` never scores or advances and permits bounded retry/pass.

No material Stage 1/2 adaptation is required. The current official contract, storage, transaction-context, equivalence and linter documentation supports the proposed mechanism, and the pre-lock probe passed current lint, schema extraction, strict typecheck and Direct Mode validator agreement/disagreement checks. Mechanical implementation details will be recorded in the change log.

## Build order

1. Implement `contracts/main.py` as the single deployable contract with the exact seven C10 writes and seven common views.
2. Add pure state, authority, bounds, replay, capacity, serialization, mocked nondeterminism and captured-validator tests in `tests/test_contract.py`.
3. Implement the functional React/Vite frontend with one shared GenLayer client, one canonical wallet-session reducer, durable Web-Locks journal, bounded RPC lifecycle and exact historical readback.
4. Add frontend unit checks for wallet cardinality and journal races; verify the rendered disconnected/pre-deploy state in a real browser. Transaction phases and the complete C10 journey remain live-E2E evidence after deployment.
5. Run exact-source lint/schema/typecheck/tests/build; package PRE_DEPLOY evidence; obtain anonymous PRE_DEPLOY approval before Studio deployment.

## Contract architecture

- Persistent fields: `case_count` plus six fully instantiated `TreeMap` indexes from Stage 2; scalar initialization only.
- Canonical JSON: exact keys, duplicate-key rejection, CRLF-to-LF text handling, UTF-8 byte caps, bool-as-int rejection and deterministic SHA-256 argument hashes.
- State machine: `INVITED → TURN → FROZEN → TURN|UNRESOLVED|DONE`; `UNRESOLVED → TURN|UNRESOLVED|EXHAUSTED`; allowed pass/resign branches exactly as specified.
- Consensus: `gl.nondet.exec_prompt(..., response_format="json")` only inside a custom validator path; each validator independently reruns the same bounded category task and compares the complete stable `{v,label}` result. No storage proxy enters the closure.
- Atomicity: construct and validate the complete next record before writing case, version and history maps.
- Exact public ABI: C10 seven writes and common seven views; no parent argument or edit-base method.

## Frontend architecture

- One responsive page with anchored New Game/Arena, current-game move history, and How It Works sections; no router dependency is needed for this bounded game.
- One EIP-6963/legacy-discovery wallet store with only detected MetaMask, OKX Wallet and Rabby providers; fresh reload is disconnected.
- One shared read/write client boundary and one journal implementation keyed by random reservation; operation fingerprint is conflict-only.
- Every write follows `IDLE → WAITING_FOR_WALLET → SUBMITTED → WAITING_FOR_FINALITY → VERIFYING_EXECUTION → VERIFYING_READBACK → SUCCESS`, with explicit rejected/failed/reconciliation branches.
- Success requires finality, semantic execution success and method-specific `get_version` or nonce/readback proof.

## Experience application map

| Experience entry | Application | Regression/evidence |
|---|---|---|
| Make custom consensus rederive the consequential judgment | Validator reruns word-category judgment and compares complete stable decision fields | Agreeing and materially conflicting captured-validator tests |
| Pin the interpreter before counting Python verification | Use and record `py -3.13`; inspect linter/test package versions | Version output plus no-cache pytest run |
| Keep specification result schemas identical to the accepted contract protocol | Diff `{v,label}` and case/journal schemas across spec, contract, frontend and tests | Exact-key schema tests and generated ABI inventory |
| Pin the compatible GenVM runner bundle, not only the linter version | Record linter 0.11.0, selected runner bundle and dependency hash; do not switch on informational newer-runner warning | Fresh exact-source semantic validation and artifact identity |
| Put the GenVM text-runner version line before the dependency manifest | Not applied as a literal two-line header: current official docs and successful current schema probe use the single first-line `Depends` magic comment; old entry is explicitly version-sensitive | Recheck current Studio template before PRE_DEPLOY; source hash changes if required |

## Test and evidence closure

Contract checks cover all method rows, wrong authority/phase/turn/revision, nonce replay/conflict, limits, six-turn outcome, pass/resign, deterministic BAD_LINK/REPEATED precedence, IN/OUT/UNKNOWN, three attempts, validator disagreement, malformed output, serialization and whole-state no-write snapshots. Frontend checks cover all wallet combinations, provider binding, journal interruption/races/capacity, no duplicate write, hidden-tab teardown, bounded polling, every transaction phase and exact historical readback.

## Risks retained

Model disagreement and SDK/network drift remain explicit runtime risks. Safe outcomes are no write, `UNRESOLVED`/`EXHAUSTED`, pass, resign or reconciliation of the same transaction hash—never optimistic success or automatic resubmission.

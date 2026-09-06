# Semantic Category Duel — PRE_DEPLOY review package

PACKAGE_ID: `SCD-PREDEPLOY-DE5921C`
CHECKPOINT: `PRE_DEPLOY`
WORKFLOW: `Build`
TASK_ID: `semantic-category-duel`
PROJECT: `E:\Genlayer-Projects\semantic-category-duel`
REVISION: `de5921ca270e1f165a3b138bc15d76c1d88b9986`
OPEN_BLOCKING_FINDINGS: `0` by primary-AI review; anonymous verdict pending.

## Product and acceptance boundary

One public six-turn category word-chain duel between two wallets. The contract exclusively enforces identity, invitation, alternating authority, revision/turn checks, link/repeat rules, scoring, pass/resign, limits and immutable history. GenLayer consensus is used only for otherwise-valid word/category membership. `UNKNOWN` awards nothing and does not advance the turn; bounded retry/pass remains available. No rewards or real-world achievement are claimed.

## Exact artifact allowlist and hashes

- `contracts/main.py` — `B68C18C21C558EDEA7FD60A2EF72AE7B29C765694D58EDFD1561871C61A00C0C`
- `frontend/src/App.tsx` — `70BAD68A6A31F3059FBEB362DD9F50B3F00ED3FC322042F1D48AFD2D95BBEE1D`
- `frontend/src/contract.ts` — `FD4EDA40566B57A577D4D39D75E4812DC1A26D6F886561FD2E5E81D83FA2A50E`
- `frontend/src/wallet.ts` — `5821FA8FD81A15DD9192AE30ED1E27775DBBB4E350847B33240E5E674945808B`
- `frontend/src/pending.ts` — `256E886A5967F0634FF9042A8BF3E9792EB51BC7E22824316B7AB010F08B6D8C`
- `docs/RPC-BUDGET.md` — `70ED63D400B2FABFAEEEFD39AD3D94319AC4361093B0C81E07C556AD38FCED58`
- `docs/STUDIO-E2E-PLAN.md` — `AB34BBFA80803513BFF18006B1564FCCD50EDC314190D75902449EA23C06B6F1`
- Supporting specification/evidence: `RESEARCH-HANDOFF.md`, `STAGE-1.md`, `STAGE-2.md`, `SPECIFICATION.md`, `docs/IMPLEMENTATION-PLAN.md`, `docs/SPEC-LOCK-EVIDENCE.md`, `docs/CODE-EDIT-EVIDENCE.md`, `docs/CLAUDE-DESIGN-RESULT.md`, and `docs/STUDIO-ACCOUNT.md`.

## Documentation/runtime binding

Checked 2026-09-07 against current official GenLayer documentation for first contract/header, storage/collections, equivalence principle, transaction context, testing/linter, Studio limitations, wallets and GenLayerJS transactions. Installed evidence: Python 3.13.6, `genvm-linter` 0.11.0, `genlayer-test` 0.29.2, `genlayer-js` 1.1.8. The first-line official `Depends` header and installed schema path agree. The linter's newer-runner notice is informational; changing the dependency now would invalidate exact-source evidence.

Official links:
- https://docs.genlayer.com/developers/intelligent-contracts/storage
- https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle
- https://docs.genlayer.com/developers/intelligent-contracts/testing
- https://docs.genlayer.com/api-references/genlayer-test
- https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio/limitations
- https://docs.genlayer.com/developers/frontend/genlayer-js
- https://docs.genlayer.com/developers/frontend/transactions
- https://docs.genlayer.com/developers/frontend/wallets

## Contract inventory

- One discoverable contract: `SemanticCategoryDuel`; constructor parameters: 0.
- Persistent fields: scalar `case_count`; fully typed `TreeMap` indexes `cases`, `nonce_index`, `actor_index`, `child_index`, `version_index`, `history`. No runtime-managed collection reassignment.
- Writes (7): `create_game`, `join_game`, `play_word`, `evaluate_move`, `retry_move`, `pass_turn`, `resign_game`.
- Views (7): `get_case`, `get_version`, `get_id_by_nonce`, `get_count`, `list_cases`, `list_actor`, `list_children`.
- Bounds: 32 cases, 32 revisions, four-item pages, bounded nonce/text/word/category/letter schemas, canonical JSON and SHA-256 argument records.
- Address normalization handles production `Address.as_hex` and Direct Mode byte-shaped addresses. Public mappings do not cross the ABI.
- No linked contract, EVM message, or value transfer exists.

## Nondeterministic inventory

`_semantic_result(category, word)` captures only primitive immutable strings. Leader and validator independently invoke the same bounded `gl.nondet.exec_prompt(..., response_format="json")`; both validate exact `{v,label}` keys and labels `IN_CATEGORY|OUT_OF_CATEGORY|UNKNOWN`. `gl.vm.run_nondet_unsafe` accepts only canonical equality of the complete stable result. Exceptions, malformed output and disagreement fail closed. Deterministic BAD_LINK and REPEATED checks precede semantic execution. Consequences: IN_CATEGORY scores/advances, OUT_OF_CATEGORY advances without score, UNKNOWN preserves turn and score and enters bounded unresolved/exhausted states.

## Verification evidence

- `genvm-lint check contracts/main.py --json`: PASS; contract `SemanticCategoryDuel`; 14 methods; 7 view; 7 write; constructor params 0.
- `py -3.13 -m pytest -q --cache-clear`: 12 passed. Coverage includes authority, revisions, replay, nonce conflict, six-turn outcome, pass/resign, deterministic precedence, IN/OUT/UNKNOWN, retry exhaustion, malformed model output, captured validator agreement/disagreement, serialization and whole-state no-write snapshots.
- `npm test`: 8 passed across wallet discovery/session, durable write journal and transaction terminal-state indicator.
- `npm run build`: PASS; 467 modules. Retained advisory: GenLayerJS causes a 736.58 kB minified / 177.14 kB gzip main chunk, above Vite's advisory threshold.
- Browser verification: desktop 960×695 and mobile 319×694, no horizontal overflow, correct disconnected/pre-deployment state, no console error. Claude presentation diff was inspected and integrated; Codex corrected reconciliation to stop its spinner.

## Frontend/trust and transaction boundary

One canonical wallet reducer filters only detected MetaMask, OKX Wallet and Rabby providers and binds the selected provider/account. Writes require Studionet `0xf22f`, a configured contract and explicit user action. The durable Web-Locks journal blocks same-case pending conflicts and preserves immutable hashes. Public phases remain `IDLE`, `WAITING_FOR_WALLET`, `SUBMITTED`, `WAITING_FOR_FINALITY`, `VERIFYING_EXECUTION`, `VERIFYING_READBACK`, `SUCCESS`, `REJECTED`, `FAILED`, `RECONCILIATION_REQUIRED`. Success requires FINALIZED, `resultName=SUCCESS`, `txExecutionResultName=FINISHED_WITH_RETURN`, and method/revision/caller historical readback. No automatic resubmission exists.

## Locked Studio target, plan and budget

- Account: `0xeF5D2119416A2f5afa35dCFA209766EFC1BE5902`, visible 998 GEN, selected read-only in `docs/STUDIO-ACCOUNT.md`.
- Exact minimum-sufficient plan: `docs/STUDIO-E2E-PLAN.md`.
- `docs/RPC-BUDGET.md` locks `OBSERVABLE_ACTION_LEDGER` before this Task's Studio E2E because browser instrumentation exposes actions/transaction states but not a reliable complete physical-request stream; no physical request count is claimed.
- Maximum: one deployment plus fourteen positive-lifecycle writes and at most one natural UNKNOWN branch action, total 16 transactions. Negative checks use no-write simulation only if available. Each hash has bounded terminal observation, one terminal receipt and one authoritative readback; no replay/redeploy for measurement.

## Invalidation and limits

The Studio plan/budget/account evidence commits after the last code change; contract and frontend hashes remain identical to the verified candidates. Documentation-only packaging does not affect runtime tests. PRE_DEPLOY approval will authorize only readiness and this plan; it is not deployment or E2E success. No Studio deployment, signature, write, contract address, live receipt, consensus result or on-chain readback exists yet, as required at this checkpoint. Vercel/GitHub/submission evidence belongs to later checkpoints.

## Primary verdict

PRIMARY REVIEW APPROVED - PRE_DEPLOY

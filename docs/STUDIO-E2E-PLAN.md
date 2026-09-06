# PRE_DEPLOY Studio plan

## Exact target

- Revision: `28ef26c33adf7c7f38ba70653ab4541a1e47f86a`
- Contract source: `contracts/main.py`
- Network: GenLayer Studionet (`61999`, `0xf22f`)
- Deployer/upgrader: select and record the existing accessible Studio account before locking the review package; do not generate or expose a key.
- Deployment: one deployment of the reviewed source after anonymous PRE_DEPLOY approval only.

## Minimum-sufficient live matrix

1. Verify network, selected account, exact source hash, schema and constructor inventory without writing.
2. Deploy once; retain deployment hash, FINALIZED lifecycle, semantic execution success, contract address and source/code parity.
3. Create one game as account A; read `get_id_by_nonce`, `get_case`, and `get_version(1)`.
4. Join as account B; verify revision, actor and phase readback.
5. Complete six turns using deterministic valid links and category words. For every play, verify FROZEN state before evaluate; for every evaluate, verify finality, execution result, consensus outcome and next historical version before continuing.
6. If a natural evaluation yields UNKNOWN, prove no score/turn advance, then use only the approved existing branch: one retry after the actual cooldown when practical, otherwise pass; never manufacture or replay a write solely to obtain UNKNOWN.
7. Verify final `DONE` outcome, scores, six-entry move ledger, revision history, actor indexes and pagination.
8. Exercise wrong-authority/revision/turn only through a no-write simulation surface if Studio exposes one; otherwise retain local negative tests and declare the live limitation rather than creating rejection transactions.

## Stop and recovery rules

- Never submit the next write before the prior hash is terminal, semantically successful and authoritatively read back.
- Preserve an ambiguous hash and reconcile it; never automatically resubmit.
- Stop on wallet/user rejection, wrong account/network, insufficient funds, malformed schema, disagreement without safe contract state, rate-limit cooldown, or source/address mismatch.
- Record every visible action, transaction, hash, status observation, terminal receipt and readback in the observable action ledger defined in `docs/RPC-BUDGET.md`.

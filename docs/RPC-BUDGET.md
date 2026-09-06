# Semantic Category Duel — RPC Budgets

## FRONTEND RPC BUDGET MATRIX
FRONTEND_MATRIX_STATUS: READY

| Screen/workflow | Trigger | Shared client | Dedup/cache | Poll policy | Hidden/unmount stop | Retry policy | Authoritative readback | Completion rule | Max requests | Max transactions | Instrumentation |
|---|---|---|---|---|---|---|---|---|---:|---:|---|
| Landing | Page load | one read client | no automatic read | none | immediate | none | none | static render | 0 | 0 | request counter |
| Case list | Explicit open/next | one read client | in-flight key and page cache | none | abort | one manual retry | `list_cases` | rendered IDs match response | 1 | 0 | method counter |
| Game detail | Explicit route/refresh | one read client | in-flight case key | none | abort | one manual retry | `get_case` | exact record rendered | 1 | 0 | method counter |
| Historical version | Explicit history click | one read client | immutable version cache | none | abort | one manual retry | `get_version` | exact version rendered | 1 | 0 | method counter |
| Connect wallet | Explicit provider choice | selected provider | one chain read per attempt | none | session teardown | one unknown-chain add/switch retry only | chain/account validation | canonical store is CONNECTED | 1 | 0 | provider counter |
| Any game write | Explicit action | selected-provider write client | one reservation and one submission | receipt at 2/4/8 seconds; readback at 0/4 seconds | pause and preserve journal | no automatic resubmit | nonce plus version 1 for create; exact next history for others | finalized plus execution success plus matching readback | 6 | 1 | lifecycle ledger |
| Resume journal | Explicit reconcile | stored chain/contract client | immutable hash only | one receipt and one view | stop after attempt | manual later reconcile | method-specific stored-context view | verified or remains reconcile | 2 | 0 | journal ledger |

Limits are per explicit journey. Hidden tabs perform zero polling; no portfolio polling exists; at most two explicit reconciliations run concurrently. Actual counts will be recorded from the exact Vercel release and must not exceed these planned maxima.

## STUDIO RPC BUDGET MATRIX

STUDIO_CAPABILITY_PROBE_STATUS: COMPLETE
STUDIO_MEASUREMENT_MODE: OBSERVABLE_ACTION_LEDGER
STUDIO_MEASUREMENT_TIMING: PRE_E2E
STUDIO_CAPABILITY_PROBE_AT: 2026-09-06T21:14:53Z
STUDIO_CAPABILITY_TOOL_OR_API: Codex browser tab accessibility/DOM state, transaction UI, and console logs
STUDIO_CAPABILITY_CHECK: Inspected the available browser instrumentation before this Task's Studio action; it exposes each primary-AI interaction and rendered transaction/readback state, but no complete physical request-event stream.
STUDIO_CAPABILITY_RESULT: Physical network requests are not reliably exposed; all primary-AI actions, submissions, hashes, polls, terminal states, and authoritative readbacks are observable.
STUDIO_PHYSICAL_COUNT_CLAIM: NONE
STUDIO_ACTION_LEDGER_STATUS: LOCKED_BEFORE_E2E

| Journey | Planned network actions | Transaction maximum | Required terminal evidence |
|---|---:|---:|---|
| Deploy | one deployment submission plus bounded status observation | 1 | finalized, semantic execution success, deployed source/address readback |
| Positive game lifecycle | create, join, six plays plus six evaluations | 14 | each hash reconciled before the next mutation and final game readback |
| Negative/no-write controls | wrong actor/revision/turn checked only if Studio exposes simulation without submission | 0 | exact error and unchanged authoritative state |
| Unknown safe-outcome branch | reuse the positive game's first semantic move if it naturally returns UNKNOWN; perform at most one retry after cooldown or pass | 1 additional | attempt counter, no score/turn advance before pass, historical readback |

The live ledger maximum is 16 transactions including deployment and one optional UNKNOWN branch action. No blind retry, replay, second deployment, or transaction created only for measurement is permitted. Status observation is bounded to 50 attempts per submitted hash at the installed client's 3-second default; stop immediately on terminal state, quota/rate-limit cooldown, or verified blocker. One terminal receipt and one authoritative readback are allowed per transaction.

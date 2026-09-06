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

Status: PLANNED — measurement mode must be probed and locked before Studio opens.

| Journey | Planned network actions | Transaction maximum | Required terminal evidence |
|---|---:|---:|---|
| Deploy | one deployment submission plus bounded status observation | 1 | finalized, semantic execution success, deployed source/address readback |
| Positive game lifecycle | create, join, six bounded turn actions/evaluations | 14 | each hash reconciled before the next mutation and final game readback |
| Negative/no-write controls | read/simulate where supported; no duplicate replacement transactions | 0 unless approved matrix requires a genuine rejection transaction | exact calldata/error and unchanged authoritative state |
| Unknown/retry/pass fixture | create, join, play, up to three accepted evaluations, pass | 7 | attempt counters, no score/turn advance before pass, final historical readback |

Studio physical RPC counts are not claimed yet. Before Studio E2E, the capability probe will choose observable physical counters or a complete action ledger and bind that mode in the PRE_DEPLOY package.

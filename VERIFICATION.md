# Semantic Category Duel verification

This is the single public verification record for the reviewed release. It contains reproducible judge-facing facts only; private evidence packages, wallet material and local operation journals are intentionally excluded from the repository.

## Exact source and deployment

- Executable release revision: `4efde52d8029659b08f390258ede6e92259bef98`
- Deployed contract source revision: `b79ff1c6e953196563df8f6663b95f29987560ae`
- `contracts/main.py` SHA-256: `A6C902B9689E012126EECD0E9BCF1835B0676CA9990EAFFD9D2DBCC4E498DB62`
- Network: GenLayer Studio Devnet, chain `61997`
- Contract: [`0x1C6Ce54fA8Fd3A99bf59c8823252Ac5bd0d5bEf1`](https://explorer-studio-dev.genlayer.com/address/0x1C6Ce54fA8Fd3A99bf59c8823252Ac5bd0d5bEf1)
- Deployment transaction: [`0x9823ca09fa2016321d8ef9e691b11551bb405cec957c7b869bc1cbe3d1fcf677`](https://explorer-studio-dev.genlayer.com/tx/0x9823ca09fa2016321d8ef9e691b11551bb405cec957c7b869bc1cbe3d1fcf677)

An independent `gen_getContractCode` readback returned `19,778` bytes, byte-identical to `contracts/main.py` and therefore the same SHA-256 above. Deployment reached `FINALIZED`, `FINISHED_WITH_RETURN` and majority agreement. Constructor arguments and linked contracts are empty; the contract is intentionally frozen.

## Reproduce tests and build

```bash
python -m pip install -r requirements-test.txt
python -m pytest -q tests/test_contract.py tests/test_current_runtime_feasibility.py
cd frontend
npm ci
npm test -- --run
npm run build
```

Reviewed result: frontend `5` files / `40` tests pass, the Vite production build transforms `471` modules, and the WSL/Linux Python run passes `21` contract/runtime tests. The Python suite verifies the current-runtime contract schema and behavior against the exact source above. On Windows, run that suite inside WSL/Linux; native Windows stdin is not a GenVM calldata stream and can fail in the direct loader before test execution.

## Live proof matrix

The Studio Devnet evidence run used one deployment and `18` post-deployment writes. Every write had a unique hash, finalized successfully, reached semantic execution success and majority consensus, and was followed by authoritative state/history readback before the next write.

| Advertised path | Live result |
|---|---|
| Create and join | Two cases created by Player A and joined by the invited Player B |
| Valid semantic scoring | `cat`, `tiger` and `rat` classified in category; score advanced only on accepted results |
| Duplicate handling | Repeated `tiger` returned deterministic `REPEATED`; score unchanged |
| Out-of-category handling | `table` returned `OUT_OF_CATEGORY / INVALID_CATEGORY`; score unchanged |
| Link enforcement | `apple` returned deterministic `BAD_LINK` |
| Six-turn completion | Case 1 ended `DONE / A_WINS`, revision `14`, score `2–1`, with six chronological moves |
| Pass and resignation | Case 2 recorded `PASS`, then Player B resigned; it ended `DONE / A_WINS`, revision `4` |
| Historical/index reads | Current case, exact versions, nonce identity, case list, actor indexes and child list matched final state |
| Negative simulations | Stale revision and bad turn were rejected read-only; authoritative state remained unchanged |

No natural `UNKNOWN` occurred, so no transaction was manufactured to force a nondeterministic branch. Retry behavior remains covered by source and automated tests rather than a false live claim.

## Frontend release evidence

Production URL: [https://semantic-category-duel.vercel.app](https://semantic-category-duel.vercel.app). The production deployment is `READY`, returns HTTP `200`, renders the expected product title and contains the reviewed Studio contract address in its built application bundle.

The final browser run must demonstrate wallet selection, account/chain guards, create/load/join/play/evaluate/pass/resign, conditional retry only after a natural `UNKNOWN`, transaction recovery without resubmission, authoritative readback, clean console output, responsive layout and measured request budgets.

Per explicit journey, the implementation caps contract/provider activity at: game detail `2` requests, unknown-chain wallet connection `7` provider calls, create `9` RPC calls / `1` transaction, another game write `7` / `1`, create reconciliation `7` / `0`, and other reconciliation `5` / `0`. There is no hidden polling.

## Known limitations

- Studio Devnet state is not permanent and may be reset.
- Semantic category membership is validator consensus, so a valid request can return `UNKNOWN` and require bounded retry/pass handling.
- The frozen contract cannot be upgraded in place.
- Browser recovery requires the local pending journal or a retained transaction hash.

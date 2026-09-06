# CODE_EDIT Evidence

- CODE_EDIT receipt: `18d28a37-8854-4a5a-8f90-23802dc32014`
- Contract: `contracts/main.py`, one `SemanticCategoryDuel` contract, 7 writes and 7 views.
- Contract verification: `py -3.13 -m pytest -q --cache-clear` → 12 passed.
- Contract lint/schema: `genvm-lint check contracts/main.py --json` → PASS, 14 methods, 7 view, 7 write, 0 constructor params.
- Frontend: React/Vite, GenLayerJS 1.1.8, EIP-6963 plus bounded legacy wallet discovery, Studionet chain guard, durable write journal, finalized execution check and authoritative historical readback.
- Frontend verification: `npm test` → 7 passed; `npm run build` → PASS.
- Browser verification: responsive disconnected/pre-deploy render checked at `http://127.0.0.1:5178/`; controls and deployment-address notice are visible; no console error observed.
- Retained warnings: newer GenVM runner is informational; Vite reports the GenLayerJS production chunk above its default 500 kB advisory threshold.
- Live evidence intentionally pending: deployment, wallet signatures, finalized Studionet receipts, semantic execution and authoritative on-chain readback require PRE_DEPLOY approval first.

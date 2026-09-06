# SPEC_LOCK Evidence

- Research package SHA-256: `3464E830908CB1D87504057567242D36BDCD0C4FD59934B7D22F6482C6799ED2`
- Stage 1 SHA-256: `4FFDA19871EA59B2EC732F9C9C116C9EC9B6EEB5E699F8FD184165331F97A6A2`
- Stage 2 SHA-256: `A7F5FBA9AB2871BBAE61BB8EDF5BB32BA78019C4967C80A23C600AFD4EB726E1`
- Governance version: `2026-09-06.10`
- SPEC_LOCK receipt: `7dd76f39-8d48-4ec9-8ddf-2ddc07889f52`
- Official documentation checked 2026-09-07: first contract/header; storage/collections; equivalence principle; transaction context; GenVM linter.
- Toolchain: Python 3.13.6; `genvm-linter` 0.11.0; `genlayer-test` 0.29.2; cached runners v0.3.0-rc7 and v0.2.16.
- Probe: `genvm-lint check --json` PASS, contract `SemanticCategoryDuelProbe`, 2 methods; schema extraction PASS; strict typecheck 0 errors/0 warnings; Direct Mode 1 passed.
- Informational warning retained: a newer runner dependency is available; no dependency change was made because the exact official dependency and current probe pass.
- Diagnosed tooling issue: human linter output failed only at Windows cp1252 rendering of the check mark; `PYTHONUTF8=1` plus JSON output completed successfully.
- Material adaptation: none.

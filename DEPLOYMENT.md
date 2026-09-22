# Studio Devnet deployment

- Network: GenLayer Studio Devnet
- Chain ID: `61997`
- RPC: `https://studio-dev.genlayer.com/api`
- Explorer: `https://explorer-studio-dev.genlayer.com/`
- Contract: `0x1C6Ce54fA8Fd3A99bf59c8823252Ac5bd0d5bEf1`
- Deployment transaction: `0x9823ca09fa2016321d8ef9e691b11551bb405cec957c7b869bc1cbe3d1fcf677`
- Deployed source commit: `b79ff1c6e953196563df8f6663b95f29987560ae`
- `contracts/main.py` SHA-256: `A6C902B9689E012126EECD0E9BCF1835B0676CA9990EAFFD9D2DBCC4E498DB62`
- Constructor arguments: none
- Upgrade policy: intentionally frozen; no upgrader or linked contract

The deployment reached `FINALIZED`, `FINISHED_WITH_RETURN`, and `MAJORITY_AGREE`. An independent `gen_getContractCode` readback matched the local contract source byte for byte.

## Recovery

- If browser-local data is lost, reconnect the same wallet and contract address, then reconcile retained transaction hashes before submitting another write.
- If Studio Devnet resets, redeploy this exact source and rerun the live matrix before updating the frontend address.
- Because this contract is intentionally frozen, a post-deployment defect requires a separately reviewed replacement deployment; it cannot be repaired in place.

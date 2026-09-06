import { describe, expect, it } from 'vitest';
import { terminalTxPhase } from '../src/App';
import type { TxPhase } from '../src/contract';

describe('transaction indicator', () => {
  it('spins only while the operation can still progress automatically', () => {
    const terminal: TxPhase[] = ['SUCCESS', 'REJECTED', 'FAILED', 'RECONCILIATION_REQUIRED'];
    const pending: TxPhase[] = ['WAITING_FOR_WALLET', 'SUBMITTED', 'WAITING_FOR_FINALITY', 'VERIFYING_EXECUTION', 'VERIFYING_READBACK'];
    expect(terminal.every(terminalTxPhase)).toBe(true);
    expect(pending.some(terminalTxPhase)).toBe(false);
  });
});

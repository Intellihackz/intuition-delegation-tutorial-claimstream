'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type TxLogEntry = {
  id: string;
  ts: number;
  kind: 'deposit' | 'redeem';
  side: 'support' | 'oppose';
  claim: string;
  termId: string;
  status: 'pending' | 'success' | 'error';
  hash?: string;
  error?: string;
};

type NewEntry = Pick<TxLogEntry, 'kind' | 'side' | 'claim' | 'termId'>;

type TxLogValue = {
  entries: TxLogEntry[];
  addEntry: (e: NewEntry) => string;
  updateEntry: (id: string, patch: Partial<TxLogEntry>) => void;
  clear: () => void;
};

const TxLogContext = createContext<TxLogValue | null>(null);

export function TxLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<TxLogEntry[]>([]);

  const addEntry = useCallback((e: NewEntry) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setEntries((prev) => [{ ...e, id, ts: Date.now(), status: 'pending' }, ...prev]);
    return id;
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<TxLogEntry>) => {
    setEntries((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return (
    <TxLogContext.Provider value={{ entries, addEntry, updateEntry, clear }}>
      {children}
    </TxLogContext.Provider>
  );
}

export function useTxLog() {
  const ctx = useContext(TxLogContext);
  if (!ctx) throw new Error('useTxLog must be used within a TxLogProvider');
  return ctx;
}

// Human-readable one-liner for an entry, e.g. "Deposit → Support".
export function describeEntry(e: TxLogEntry): string {
  const verb = e.kind === 'deposit' ? 'Deposit' : 'Withdraw';
  const target = e.side === 'support' ? 'Support' : 'Oppose';
  return `${verb} ${target}`;
}

// The actual contract call the relayer submitted, for the dev-facing log.
export function callSignature(e: TxLogEntry): string {
  return e.kind === 'deposit'
    ? 'MultiVault.deposit(receiver, termId, curveId, minShares)'
    : 'MultiVault.redeem(receiver, termId, curveId, shares, minAssets)';
}

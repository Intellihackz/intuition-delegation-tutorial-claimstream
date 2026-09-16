'use client';

import { useState } from 'react';
import { intuitionMainnet } from '@/lib/chains';
import { useTxLog, describeEntry, callSignature, type TxLogEntry } from '@/lib/TxLogContext';

const STORAGE_KEY = 'intuition_txlog_open';
const explorerBase = intuitionMainnet.blockExplorers?.default.url;

const readOpen = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

function StatusDot({ status }: { status: TxLogEntry['status'] }) {
  const color =
    status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export function TxLogPanel() {
  const { entries, clear } = useTxLog();
  const [open, setOpen] = useState(readOpen);

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? '0' : '1');
      } catch {}
      return !v;
    });
  };

  if (entries.length === 0) return null;

  const pending = entries.filter((e) => e.status === 'pending').length;
  const failed = entries.filter((e) => e.status === 'error').length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-[#0a0a0a]/95 backdrop-blur">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-white/60 hover:text-white transition-colors"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>Delegated activity log</span>
        <span className="text-white/30">·</span>
        <span>{entries.length} op{entries.length === 1 ? '' : 's'}</span>
        {pending > 0 && <span className="text-amber-400">· {pending} pending</span>}
        {failed > 0 && <span className="text-red-400">· {failed} failed</span>}
        <span className="ml-auto flex items-center gap-3">
          {open && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="text-white/30 hover:text-white/70 normal-case tracking-normal"
            >
              clear
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="max-h-[38vh] overflow-y-auto border-t border-white/10 px-4 py-2 text-xs font-mono">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
              <StatusDot status={e.status} />
              <span className="text-white/30 shrink-0 w-16">
                {new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-white/80">
                  {describeEntry(e)} <span className="text-white/35">— {e.claim}</span>
                </div>
                <div className="text-white/35 break-all">{callSignature(e)}</div>
                {e.error && <div className="text-red-400/80 break-words mt-0.5">{e.error}</div>}
              </div>
              {e.hash && explorerBase && (
                <a
                  href={`${explorerBase}/tx/${e.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-white/40 hover:text-white uppercase tracking-widest"
                >
                  tx ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAdminDelegation, ADMIN_DELEGATEE } from '@/hooks/useAdminDelegation';
import { intuitionMainnet } from '@/lib/chains';
import { formatEther, parseEther } from 'viem';

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'now';
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secondsLeft}s`;
}

export function UpgradeAccount() {
  const { address } = useWallet();
  const {
    smartAccount,
    delegation,
    isDeploying,
    error,
    setupDelegation,
    revokeDelegation,
    hsaBalance,
    dailyCap,
    periodAvailable,
    periodResetsAt,
  } = useAdminDelegation();
  const [cap, setCap] = useState('1');
  const [prefund, setPrefund] = useState('5');
  const [copied, setCopied] = useState(false);
  const [nowSec, setNowSec] = useState(0);

  // Keep a current-time tick so the "resets in" countdown stays fresh.
  useEffect(() => {
    const update = () => setNowSec(Math.floor(Date.now() / 1000));
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, []);

  if (!address) return null;

  const hsaAddress = smartAccount?.address;
  const explorerBase = intuitionMainnet.blockExplorers?.default.url;

  let capWei = BigInt(0);
  try {
    capWei = parseEther(dailyCap || '0');
  } catch {}
  const availableWei = periodAvailable ?? capWei;
  const allowancePct =
    capWei > BigInt(0)
      ? Math.min(100, Math.max(0, Number((availableWei * BigInt(10000)) / capWei) / 100))
      : 0;
  const resetsInSeconds = periodResetsAt && nowSec ? periodResetsAt - nowSec : null;

  const prefundTooLow = Number(prefund) > 0 && Number(cap) > 0 && Number(prefund) < Number(cap);

  const copyHsa = async () => {
    if (!hsaAddress) return;
    try {
      await navigator.clipboard.writeText(hsaAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Delegated Staking</h3>
          <p className="text-sm text-white/60 mb-1">
            Deploy your Hybrid Smart Account and delegate to our secure Admin Wallet to enable seamless delegated staking.
          </p>
          <p className="text-xs text-white/40">
            Admin Delegatee: {ADMIN_DELEGATEE.slice(0, 6)}...{ADMIN_DELEGATEE.slice(-4)}
          </p>
        </div>

        <div className="flex gap-4 items-center">
          {delegation ? (
            <button
              onClick={revokeDelegation}
              disabled={isDeploying}
              className="px-4 py-2 border border-red-500/50 text-red-400 font-bold uppercase tracking-wider text-sm hover:bg-red-500/10 disabled:opacity-50 transition-colors rounded"
            >
              {isDeploying ? 'Revoking...' : 'Disable Delegated Staking (On-Chain)'}
            </button>
          ) : (
            <div className="flex gap-2 items-end flex-wrap">
              <label className="flex flex-col text-[10px] uppercase tracking-widest text-white/40">
                Daily limit
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                    className="px-3 py-2 bg-black border border-white/20 text-white rounded text-sm w-24 outline-none focus:border-white/50"
                    min="0"
                    step="any"
                  />
                  <span className="text-white/60 text-xs">TRUST</span>
                </div>
              </label>
              <label className="flex flex-col text-[10px] uppercase tracking-widest text-white/40">
                Fund HSA
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    value={prefund}
                    onChange={(e) => setPrefund(e.target.value)}
                    className="px-3 py-2 bg-black border border-white/20 text-white rounded text-sm w-24 outline-none focus:border-white/50"
                    min="0"
                    step="any"
                  />
                  <span className="text-white/60 text-xs">TRUST</span>
                </div>
              </label>
              <button
                onClick={() => setupDelegation(cap, prefund, 100)}
                disabled={
                  isDeploying ||
                  !smartAccount ||
                  Number(cap) <= 0 ||
                  Number(prefund) <= 0 ||
                  prefundTooLow
                }
                className="px-4 py-2 bg-white text-black font-bold uppercase tracking-wider text-sm hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded"
              >
                {isDeploying ? 'Setting up...' : 'Enable Delegated Staking'}
              </button>
            </div>
          )}
        </div>
      </div>

      {!delegation && (
        <p className="mt-3 text-xs text-white/40">
          The relayer can spend at most your <span className="text-white/60">daily limit</span> per 24h, then the
          allowance resets automatically. <span className="text-white/60">Fund HSA</span> is the total balance moved
          into your smart account &mdash; top it up anytime to extend the runway. Revoking sweeps the unspent balance back.
        </p>
      )}
      {prefundTooLow && !delegation && (
        <p className="mt-2 text-xs text-amber-400/80">Fund HSA should be at least one daily limit.</p>
      )}

      {delegation && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded">
          <div className="mb-3 font-bold">Successfully configured! Your Delegated Staking is active.</div>

          {hsaAddress && (
            <div className="mb-3">
              <div className="text-xs text-green-300/70 uppercase tracking-widest mb-1">Hybrid Smart Account</div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs text-green-200 break-all font-mono">{hsaAddress}</code>
                <button
                  onClick={copyHsa}
                  className="text-[10px] uppercase tracking-widest px-2 py-0.5 border border-green-500/30 rounded hover:bg-green-500/10"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {explorerBase && (
                  <a
                    href={`${explorerBase}/address/${hsaAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] uppercase tracking-widest px-2 py-0.5 border border-green-500/30 rounded hover:bg-green-500/10"
                  >
                    Explorer &#8599;
                  </a>
                )}
              </div>
            </div>
          )}

          {hsaBalance !== null && (
            <div className="flex justify-between text-xs mb-3 text-green-300">
              <span>HSA Balance</span>
              <span>{Number(formatEther(hsaBalance)).toFixed(3)} TRUST</span>
            </div>
          )}

          {capWei > BigInt(0) && (
            <div>
              <div className="flex justify-between text-xs mb-1 text-green-300">
                <span>Daily Allowance Remaining</span>
                <span>
                  {Number(formatEther(availableWei)).toFixed(3)} / {Number(formatEther(capWei)).toFixed(3)} TRUST
                  {resetsInSeconds !== null ? ` · resets in ${formatCountdown(resetsInSeconds)}` : ''}
                </span>
              </div>
              <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-500"
                  style={{ width: `${allowancePct}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded break-words">
          Error: {error}
        </div>
      )}
    </div>
  );
}

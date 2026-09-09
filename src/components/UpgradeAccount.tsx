'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAdminDelegation, SETUP_STEPS } from '@/hooks/useAdminDelegation';
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

export function UpgradeAccount({ state }: { state: ReturnType<typeof useAdminDelegation> }) {
  const { address } = useWallet();
  const {
    smartAccount,
    delegation,
    error,
    busyStep,
    isBusy,
    wizard,
    deployHsa,
    fundHsa,
    approveMultiVault,
    signDelegation,
    revokeDelegation,
    hsaBalance,
    dailyCap,
    periodAvailable,
    periodResetsAt,
  } = state;
  const [fundAmount, setFundAmount] = useState('5');
  const [cap, setCap] = useState('1');
  const [copied, setCopied] = useState(false);
  const [nowSec, setNowSec] = useState(0);

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

  // First step that isn't done yet.
  const currentIndex = !wizard.deployed ? 0 : !wizard.funded ? 1 : !wizard.approved ? 2 : 3;
  const step = SETUP_STEPS[currentIndex];

  const runCurrentStep = () => {
    if (step.key === 'deploy') deployHsa();
    else if (step.key === 'fund') fundHsa(fundAmount);
    else if (step.key === 'approve') approveMultiVault();
    else signDelegation(cap, 100);
  };

  const stepBusy = busyStep === step.key;
  const stepDisabled =
    isBusy ||
    !smartAccount ||
    (step.key === 'fund' && Number(fundAmount) <= 0) ||
    (step.key === 'sign' && Number(cap) <= 0);

  const copyHsa = async () => {
    if (!hsaAddress) return;
    try {
      await navigator.clipboard.writeText(hsaAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const hsaLine = hsaAddress && (
    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
      <span className="text-white/40 uppercase tracking-widest">HSA</span>
      <code className="text-white/70 break-all">{hsaAddress}</code>
      <button onClick={copyHsa} className="uppercase tracking-widest px-1.5 py-0.5 border border-white/15 rounded hover:bg-white/10">
        {copied ? 'Copied' : 'Copy'}
      </button>
      {explorerBase && (
        <a
          href={`${explorerBase}/address/${hsaAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="uppercase tracking-widest px-1.5 py-0.5 border border-white/15 rounded hover:bg-white/10"
        >
          Explorer &#8599;
        </a>
      )}
    </div>
  );

  return (
    <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Delegated Staking</h3>
          <p className="text-sm text-white/60 max-w-md">
            Your smart account holds the budget; a daily-capped delegation lets our relayer submit deposits from it and cover the gas &mdash; so Support / Oppose never opens your wallet.
          </p>
        </div>

        {delegation && (
          <button
            onClick={revokeDelegation}
            disabled={isBusy}
            className="px-4 py-2 border border-red-500/50 text-red-400 font-bold uppercase tracking-wider text-sm hover:bg-red-500/10 disabled:opacity-50 transition-colors rounded"
          >
            {busyStep === 'revoke' ? 'Revoking...' : 'Disable Delegated Staking (On-Chain)'}
          </button>
        )}
      </div>

      {/* One-step-at-a-time wizard */}
      {!delegation && (
        <div className="mt-5 border-t border-white/10 pt-5">
          {/* progress rail */}
          <div className="flex items-center gap-2 mb-5">
            {SETUP_STEPS.map((s, i) => {
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold ${
                      done
                        ? 'bg-green-500 border-green-500 text-black'
                        : active
                          ? 'border-white text-white'
                          : 'border-white/25 text-white/40'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {i < SETUP_STEPS.length - 1 && (
                    <span className={`h-px flex-1 ${done ? 'bg-green-500/60' : 'bg-white/15'}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] uppercase tracking-widest text-white/40 mb-1">
            Step {currentIndex + 1} of {SETUP_STEPS.length}
          </div>
          <div className="text-white font-semibold mb-1">{step.title}</div>
          <p className="text-sm text-white/55 leading-relaxed mb-4 max-w-lg">
            {step.detail}
            {step.docUrl && (
              <>
                {' '}
                <a
                  href={step.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/75 underline underline-offset-2 hover:text-white whitespace-nowrap"
                >
                  view the source ↗
                </a>
              </>
            )}
          </p>

          <div className="flex items-end gap-3 flex-wrap">
            {step.key === 'fund' && (
              <label className="flex flex-col text-[10px] uppercase tracking-widest text-white/40">
                Amount
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    disabled={isBusy}
                    min="0"
                    step="any"
                    className="px-3 py-2 bg-black border border-white/20 text-white rounded text-sm w-28 outline-none focus:border-white/50"
                  />
                  <span className="text-white/60 text-xs">TRUST</span>
                </div>
              </label>
            )}
            {step.key === 'sign' && (
              <label className="flex flex-col text-[10px] uppercase tracking-widest text-white/40">
                Daily limit
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                    disabled={isBusy}
                    min="0"
                    step="any"
                    className="px-3 py-2 bg-black border border-white/20 text-white rounded text-sm w-28 outline-none focus:border-white/50"
                  />
                  <span className="text-white/60 text-xs">TRUST / day</span>
                </div>
              </label>
            )}

            <button
              onClick={runCurrentStep}
              disabled={stepDisabled}
              className="px-4 py-2 bg-white text-black font-bold uppercase tracking-wider text-sm hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded"
            >
              {stepBusy ? 'Working…' : step.action}
            </button>

            {stepBusy && (
              <span className="text-xs text-white/50">
                {step.key === 'sign' ? 'Sign in your wallet…' : 'Confirm in your wallet…'}
              </span>
            )}
          </div>

          {wizard.deployed && hsaAddress && <div className="mt-4">{hsaLine}</div>}
          {wizard.deployed && hsaBalance !== null && (
            <div className="mt-2 text-xs text-white/45">
              HSA balance: {Number(formatEther(hsaBalance)).toFixed(3)} TRUST
            </div>
          )}
          <p className="mt-4 text-xs text-white/35">
            Four one-time steps. Revoking later sweeps any unspent HSA balance back to your wallet.
          </p>
        </div>
      )}

      {delegation && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded">
          <div className="mb-3 font-bold">Delegated staking is active.</div>

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

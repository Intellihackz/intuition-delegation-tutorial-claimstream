'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { useAdminDelegation, ADMIN_DELEGATEE } from '@/hooks/useAdminDelegation';
import { formatEther } from 'viem';

export function UpgradeAccount() {
  const { address } = useWallet();
  const { smartAccount, delegation, isDeploying, error, setupDelegation, revokeDelegation, hsaBalance, initialBudget } = useAdminDelegation();
  const [budget, setBudget] = useState('5');

  if (!address) return null;

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
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="Budget (TRUST)"
                className="px-3 py-2 bg-black border border-white/20 text-white rounded text-sm w-32 outline-none focus:border-white/50"
                min="0"
                step="any"
              />
              <span className="text-white/60 text-xs mr-2">TRUST</span>
              <button
                onClick={() => setupDelegation(budget, 100)} // 100 max actions
                disabled={isDeploying || !smartAccount || Number(budget) <= 0}
                className="px-4 py-2 bg-white text-black font-bold uppercase tracking-wider text-sm hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded"
              >
                {isDeploying ? 'Setting up...' : 'Enable Delegated Staking'}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {delegation && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded">
          <div className="mb-2 font-bold">Successfully configured! Your Delegated Staking is active.</div>
          
          {hsaBalance !== null && Number(initialBudget) > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1 text-green-300">
                <span>HSA Budget Remaining</span>
                <span>{Number(formatEther(hsaBalance)).toFixed(3)} TRUST</span>
              </div>
              <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-green-500 h-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, (Number(formatEther(hsaBalance)) / Number(initialBudget)) * 100))}%` }}
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

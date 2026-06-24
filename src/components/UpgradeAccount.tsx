'use client';

import { useWallet } from '@/lib/WalletContext';
import { useSmartAccountUpgrade } from '@/hooks/useSmartAccountUpgrade';

export function UpgradeAccount() {
  const { address } = useWallet();
  const { upgrade, isPending, isSuccess, txHash, error } = useSmartAccountUpgrade();

  if (!address) return null;

  return (
    <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-lg">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">Upgrade to Smart Account</h3>
          <p className="text-sm text-white/60">Unlock ERC-7710 delegation features on Intuition Testnet.</p>
        </div>
        <button
          onClick={upgrade}
          disabled={isPending || isSuccess}
          className="px-4 py-2 bg-white text-black font-bold uppercase tracking-wider text-sm hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Upgrading...' : isSuccess ? 'Upgraded' : 'Upgrade'}
        </button>
      </div>
      
      {isSuccess && txHash && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded">
          Successfully upgraded! Tx Hash:{' '}
          <a href={`https://testnet.explorer.intuition.systems/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-300">
            {txHash}
          </a>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded wrap-break-word">
          Error: {error.message || 'Failed to upgrade account'}
        </div>
      )}
    </div>
  );
}

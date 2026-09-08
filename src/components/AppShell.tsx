'use client';

import { useWallet } from '@/lib/WalletContext';
import { useAdminDelegation } from '@/hooks/useAdminDelegation';
import { UpgradeAccount } from './UpgradeAccount';
import { ClaimFeed } from './ClaimFeed';

export function AppShell() {
  const { address } = useWallet();
  const delegationState = useAdminDelegation();
  const { delegation } = delegationState;

  return (
    <>
      <UpgradeAccount state={delegationState} />

      {address && delegation ? (
        <div className="mt-20">
          <h2 className="text-sm font-bold text-white/50 mb-8 uppercase tracking-widest border-b border-white/10 pb-4">
            Activity Feed
          </h2>
          <ClaimFeed />
        </div>
      ) : (
        <p className="mt-16 text-center text-white/30 font-mono text-xs uppercase tracking-widest">
          {address
            ? 'Complete delegated staking setup to open the claim feed'
            : 'Connect your wallet to get started'}
        </p>
      )}
    </>
  );
}

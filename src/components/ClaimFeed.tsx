'use client';

import { useWallet } from '@/lib/WalletContext';
import { useGetTriplesQuery, useInfiniteGetTriplesQuery } from '@0xintuition/graphql';
import { multiVaultDeposit } from '@0xintuition/protocol';
import { formatUnits, parseEther } from 'viem';
import { useState, useRef, useCallback } from 'react';

const MULTIVAULT_ADDRESS = '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91';

function ClaimItem({ claim, refetch }: { claim: any, refetch: () => void }) {
  const { address, walletClient, publicClient } = useWallet();
  const [isPending, setIsPending] = useState(false);
  
  // The SDK queries return a slightly different shape
  const curveId = BigInt(1); // Default Curve
  const supportShares = claim.term?.vaults?.[0]?.total_shares || '0';
  const opposeShares = claim.counter_term?.vaults?.[0]?.total_shares || '0';

  const handleSupport = async () => {
    if (!address || !walletClient || !publicClient) return;
    setIsPending(true);
    try {
      const patchedWalletClient = { ...walletClient, account: address };
      await multiVaultDeposit(
        { address: MULTIVAULT_ADDRESS, walletClient: patchedWalletClient as any, publicClient },
        {
          args: [address, claim.term_id, curveId, BigInt(0)],
          value: parseEther("0.001"), // 0.001 tTRUST (min deposit)
        }
      );
      refetch();
    } catch (e) {
      console.error(e);
    }
    setIsPending(false);
  };

  const handleOppose = async () => {
    if (!address || !walletClient || !publicClient) return;
    setIsPending(true);
    try {
      const patchedWalletClient = { ...walletClient, account: address };
      await multiVaultDeposit(
        { address: MULTIVAULT_ADDRESS, walletClient: patchedWalletClient as any, publicClient },
        {
          args: [address, claim.counter_term_id, curveId, BigInt(0)],
          value: parseEther("0.001"), // 0.001 tTRUST (min deposit)
        }
      );
      refetch();
    } catch (e) {
      console.error(e);
    }
    setIsPending(false);
  };

  const creatorAddress = claim.creator?.id || '0x0000000000000000000000000000000000000000';
  const truncatedCreator = `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}`;

  return (
    <div className="border border-white/10 p-5 bg-[#0a0a0a] mb-6 transition-all hover:bg-[#111] cursor-default flex space-x-4">
      {/* Avatar Placeholder */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-mono text-sm text-white/50">
          {creatorAddress.slice(2, 4).toUpperCase()}
        </div>
      </div>
      
      {/* Tweet Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-bold text-white hover:underline cursor-pointer font-mono">
            {truncatedCreator}
          </span>
          <span className="text-white/30 text-xs font-mono tracking-wider">
            {new Date(claim.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Body */}
        <div className="text-white/90 text-base leading-relaxed mb-4">
          <span className="font-semibold text-white">{claim.subject?.label || 'UNKNOWN'}</span>
          <span className="text-white/50 mx-1">{claim.predicate?.label || 'claims'}</span>
          <span className="font-medium text-white">{claim.object?.label || 'No description'}</span>
        </div>
        
        {/* Actions (Support / Oppose) */}
        <div className="flex items-center space-x-6 text-sm text-white/50 font-mono">
          <button 
            onClick={handleSupport}
            disabled={isPending}
            className="flex items-center space-x-2 hover:text-white transition-colors disabled:opacity-50 group"
          >
            <span className="group-hover:bg-white group-hover:text-black border border-white/20 px-2 py-0.5 rounded-full transition-all">
              ↑ SUPPORT
            </span>
            <span>{Number(formatUnits(BigInt(supportShares), 18)).toFixed(4)}</span>
          </button>
          
          <button 
            onClick={handleOppose}
            disabled={isPending}
            className="flex items-center space-x-2 hover:text-white transition-colors disabled:opacity-50 group"
          >
            <span className="group-hover:bg-white group-hover:text-black border border-white/20 px-2 py-0.5 rounded-full transition-all">
              ↓ OPPOSE
            </span>
            <span>{Number(formatUnits(BigInt(opposeShares), 18)).toFixed(4)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClaimFeed() {
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteGetTriplesQuery(
    {
      limit: 10,
      orderBy: [{ created_at: 'desc' }]
    },
    {
      initialPageParam: { offset: 0 },
      getNextPageParam: (lastPage, allPages) => {
        if (lastPage.triples.length < 10) return undefined;
        return { offset: allPages.length * 10 };
      }
    }
  );

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || isFetchingNextPage) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  if (isLoading && !data) return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-6 py-1"><div className="h-2 bg-white/20 rounded"></div><div className="space-y-3"><div className="grid grid-cols-3 gap-4"><div className="h-2 bg-white/20 rounded col-span-2"></div><div className="h-2 bg-white/20 rounded col-span-1"></div></div><div className="h-2 bg-white/20 rounded"></div></div></div></div>;
  if (error) return <div className="text-red-500 font-mono">ERROR: {error.message}</div>;
  if (!data?.pages[0]?.triples?.length) return <div className="text-white/50 text-center py-8 font-mono tracking-widest text-sm uppercase">NO CLAIMS FOUND. BE THE FIRST.</div>;

  return (
    <div className="space-y-4">
      {data.pages.map((page, i) => (
        <div key={i}>
          {page.triples.map((claim: any) => (
            <ClaimItem key={claim.term_id} claim={claim} refetch={refetch} />
          ))}
        </div>
      ))}
      
      <div ref={loadMoreRef} className="py-4 text-center">
        {isFetchingNextPage && <div className="text-white/50 font-mono text-xs uppercase tracking-widest animate-pulse">Loading older claims...</div>}
        {!hasNextPage && data.pages.length > 0 && <div className="text-white/30 font-mono text-xs uppercase tracking-widest">End of feed</div>}
      </div>
    </div>
  );
}

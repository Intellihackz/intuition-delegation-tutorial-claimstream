'use client';

import { useWallet } from '@/lib/WalletContext';
import { useClaimFeed, type FeedClaim } from '@/hooks/useClaimFeed';
import { useTxLog } from '@/lib/TxLogContext';
import { formatUnits, parseEther } from 'viem';
import { useRef, useState, useCallback } from 'react';

const PORTAL_TRIPLE_URL = (termId: string) =>
  `https://portal.intuition.systems/explore/triple/${termId}?tab=positions`;

const STAKE_AMOUNT = parseEther('0.01'); // protocol minimum deposit
const CURVE_ID = BigInt(1); // default bonding curve

// created_at comes back as an ISO string; guard against a missing/bad value
// instead of rendering "Invalid Date".
const formatClaimDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};

type VaultWithPositions = { positions?: { shares?: string | null }[] } | null | undefined;

// Does the connected wallet hold shares in this vault? The positions list is
// pre-filtered to the current address by the GraphQL query.
const holdsPosition = (vault: VaultWithPositions): boolean =>
  Array.isArray(vault?.positions) &&
  vault.positions.some((p) => {
    try {
      return BigInt(p?.shares ?? '0') > BigInt(0);
    } catch {
      return false;
    }
  });

const getDelegationKey = (addr: string) => `intuition_admin_delegation_${addr.toLowerCase()}`;
const reviveBigInt = (key: string, value: unknown) =>
  typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value;
const bigintReplacer = (key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() + 'n' : value;

type Side = 'support' | 'oppose';

function ClaimItem({ claim, refetch }: { claim: FeedClaim; refetch: () => void }) {
  const { address } = useWallet();
  const { addEntry, updateEntry } = useTxLog();
  const [isPending, setIsPending] = useState(false);
  // Optimistic overrides shown until the indexer catches up. `undefined` = use
  // on-chain state; `null` = optimistically holding nothing.
  const [optimisticHeld, setOptimisticHeld] = useState<Side | null | undefined>(undefined);
  const [optimisticSupport, setOptimisticSupport] = useState<bigint | null>(null);
  const [optimisticOppose, setOptimisticOppose] = useState<bigint | null>(null);
  // Only the most recent action's refetch should clear the optimistic view, so
  // that clicking again during the indexer-lag window doesn't cause flicker.
  const opSeq = useRef(0);
  // Synchronous guard: `isPending` (and the disabled button) only take effect on
  // the next render, so a fast double-click could slip a second `act` through.
  const running = useRef(false);

  const supportTermId = claim.term_id;
  const opposeTermId = claim.counter_term_id;
  const supportBase = BigInt(claim.term?.vaults?.[0]?.total_shares || '0');
  const opposeBase = BigInt(claim.counter_term?.vaults?.[0]?.total_shares || '0');
  const supportShares = optimisticSupport ?? supportBase;
  const opposeShares = optimisticOppose ?? opposeBase;

  const heldOnChain: Side | null = holdsPosition(claim.term?.vaults?.[0])
    ? 'support'
    : holdsPosition(claim.counter_term?.vaults?.[0])
      ? 'oppose'
      : null;
  const held: Side | null = optimisticHeld !== undefined ? optimisticHeld : heldOnChain;

  const claimLabel =
    [claim.subject?.label, claim.predicate?.label, claim.object?.label].filter(Boolean).join(' ') || 'claim';

  const clearOptimistic = () => {
    setOptimisticHeld(undefined);
    setOptimisticSupport(null);
    setOptimisticOppose(null);
  };

  // One delegated deposit or redeem, logged to the activity panel.
  const runDelegatedOp = async (kind: 'deposit' | 'redeem', side: Side, termId: string, delegation: unknown) => {
    const logId = addEntry({ kind, side, claim: claimLabel, termId });
    try {
      const res = await fetch('/api/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          {
            delegation,
            action: kind,
            termId,
            curveId: CURVE_ID.toString(),
            assets: kind === 'deposit' ? STAKE_AMOUNT.toString() : undefined,
            userAddress: address,
          },
          bigintReplacer,
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.details || json.error || `${kind} failed`);
      updateEntry(logId, { status: 'success', hash: json.hash });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed';
      updateEntry(logId, { status: 'error', error: msg });
      throw new Error(msg);
    }
  };

  const act = async (clicked: Side) => {
    if (!address || running.current) return;
    const stored = localStorage.getItem(getDelegationKey(address));
    const delegation = stored ? JSON.parse(stored, reviveBigInt) : null;
    if (!delegation) {
      alert('Enable delegated staking to use the feed.');
      return;
    }
    running.current = true;

    const termFor = (side: Side) => (side === 'support' ? supportTermId : opposeTermId);
    const baseFor = (side: Side) => (side === 'support' ? supportBase : opposeBase);
    const setOptimisticFor = (side: Side, v: bigint) =>
      side === 'support' ? setOptimisticSupport(v) : setOptimisticOppose(v);

    const seq = (opSeq.current += 1);
    // Re-sync from the indexer once, unless a newer action has since started.
    const scheduleResync = (delayMs: number) =>
      setTimeout(() => {
        if (opSeq.current !== seq) return;
        refetch();
        clearOptimistic();
      }, delayMs);

    setIsPending(true);
    try {
      if (held === clicked) {
        // Toggle off — withdraw the position on this side.
        await runDelegatedOp('redeem', clicked, termFor(clicked), delegation);
        setOptimisticHeld(null);
        setOptimisticFor(clicked, BigInt(0));
      } else if (held && held !== clicked) {
        // Switch sides — withdraw the current side, then deposit on the clicked side.
        await runDelegatedOp('redeem', held, termFor(held), delegation);
        setOptimisticFor(held, BigInt(0));
        await runDelegatedOp('deposit', clicked, termFor(clicked), delegation);
        setOptimisticHeld(clicked);
        setOptimisticFor(clicked, baseFor(clicked) + STAKE_AMOUNT);
      } else {
        // Fresh position — deposit on the clicked side.
        await runDelegatedOp('deposit', clicked, termFor(clicked), delegation);
        setOptimisticHeld(clicked);
        setOptimisticFor(clicked, baseFor(clicked) + STAKE_AMOUNT);
      }
      scheduleResync(4000);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Transaction failed');
      scheduleResync(2000);
    } finally {
      running.current = false;
      setIsPending(false);
    }
  };

  const creatorAddress = claim.creator?.id || '0x0000000000000000000000000000000000000000';
  const creatorName = claim.creator?.label || `${creatorAddress.slice(0, 6)}...${creatorAddress.slice(-4)}`;
  const claimDate = formatClaimDate(claim.created_at);

  const supportTitle =
    held === 'support'
      ? 'Withdraw your Support position'
      : held === 'oppose'
        ? 'Switch sides: withdraw Oppose, then Support'
        : 'Support this claim (deposit 0.01 TRUST)';
  const opposeTitle =
    held === 'oppose'
      ? 'Withdraw your Oppose position'
      : held === 'support'
        ? 'Switch sides: withdraw Support, then Oppose'
        : 'Oppose this claim (deposit 0.01 TRUST)';

  return (
    <div className="border border-white/10 p-5 bg-[#0a0a0a] mb-6 transition-all hover:bg-[#111] cursor-default flex space-x-4">
      <div className="shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-mono text-sm text-white/50">
          {creatorAddress.slice(2, 4).toUpperCase()}
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-bold text-white hover:underline cursor-pointer font-mono">{creatorName}</span>
          <div className="flex items-center space-x-3">
            <a
              href={PORTAL_TRIPLE_URL(claim.term_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-white text-[10px] font-mono uppercase tracking-widest transition-colors"
            >
              Portal ↗
            </a>
            {claimDate && <span className="text-white/30 text-xs font-mono tracking-wider">{claimDate}</span>}
          </div>
        </div>

        <div className="text-white/90 text-base leading-relaxed mb-4">
          <span className="font-semibold text-white">{claim.subject?.label || 'UNKNOWN'}</span>
          <span className="text-white/50 mx-1">{claim.predicate?.label || 'claims'}</span>
          <span className="font-medium text-white">{claim.object?.label || 'No description'}</span>
        </div>

        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap text-sm text-white/50 font-mono">
          <button
            onClick={() => act('support')}
            disabled={isPending}
            title={supportTitle}
            className="flex items-center space-x-2 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-wait group"
          >
            <span
              className={`border px-2 py-0.5 rounded-full whitespace-nowrap transition-all ${
                held === 'support'
                  ? 'border-green-500 bg-green-500/15 text-green-300'
                  : 'border-white/20 group-hover:bg-white group-hover:text-black'
              }`}
            >
              {held === 'support' ? '↑ SUPPORTING' : '↑ SUPPORT'}
            </span>
            <span className={held === 'support' ? 'text-green-400 font-bold' : ''}>
              {Number(formatUnits(supportShares, 18)).toFixed(4)}
            </span>
          </button>

          <button
            onClick={() => act('oppose')}
            disabled={isPending}
            title={opposeTitle}
            className="flex items-center space-x-2 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-wait group"
          >
            <span
              className={`border px-2 py-0.5 rounded-full whitespace-nowrap transition-all ${
                held === 'oppose'
                  ? 'border-red-500 bg-red-500/15 text-red-300'
                  : 'border-white/20 group-hover:bg-white group-hover:text-black'
              }`}
            >
              {held === 'oppose' ? '↓ OPPOSING' : '↓ OPPOSE'}
            </span>
            <span className={held === 'oppose' ? 'text-red-400 font-bold' : ''}>
              {Number(formatUnits(opposeShares, 18)).toFixed(4)}
            </span>
          </button>
        </div>

        {held && (
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/35">
            You{' '}
            <span className={held === 'support' ? 'text-green-400/80' : 'text-red-400/80'}>
              {held === 'support' ? 'support' : 'oppose'}
            </span>{' '}
            this &mdash; click {held === 'support' ? 'Supporting' : 'Opposing'} to withdraw, or the other side to switch
          </p>
        )}
      </div>
    </div>
  );
}

export function ClaimFeed() {
  const { address } = useWallet();
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useClaimFeed(address);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  if (isLoading && !data)
    return (
      <div className="animate-pulse flex space-x-4">
        <div className="flex-1 space-y-6 py-1">
          <div className="h-2 bg-white/20 rounded"></div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div className="h-2 bg-white/20 rounded col-span-2"></div>
              <div className="h-2 bg-white/20 rounded col-span-1"></div>
            </div>
            <div className="h-2 bg-white/20 rounded"></div>
          </div>
        </div>
      </div>
    );
  if (error)
    return <div className="text-red-500 font-mono">ERROR: {error instanceof Error ? error.message : 'An error occurred'}</div>;
  if (!data?.pages[0]?.triples?.length)
    return (
      <div className="text-white/50 text-center py-8 font-mono tracking-widest text-sm uppercase">
        NO CLAIMS FOUND. BE THE FIRST.
      </div>
    );

  return (
    <div className="space-y-4">
      {data.pages.map((page, i) => (
        <div key={i}>
          {page.triples.map((claim) => (
            <ClaimItem key={claim.term_id} claim={claim} refetch={refetch} />
          ))}
        </div>
      ))}

      <div ref={loadMoreRef} className="py-4 text-center">
        {isFetchingNextPage && (
          <div className="text-white/50 font-mono text-xs uppercase tracking-widest animate-pulse">
            Loading older claims...
          </div>
        )}
        {!hasNextPage && data.pages.length > 0 && (
          <div className="text-white/30 font-mono text-xs uppercase tracking-widest">End of feed</div>
        )}
      </div>
    </div>
  );
}

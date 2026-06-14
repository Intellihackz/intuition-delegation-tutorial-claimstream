'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { createAtomFromString, createTripleStatement } from '@0xintuition/sdk';
import { parseEther } from 'viem';

const MULTIVAULT_ADDRESS = '0x2Ece8D4dEdcB9918A398528f3fa4688b1d2CAB91';

export function CreateClaimForm() {
  const [claimText, setClaimText] = useState('');
  const { address, walletClient, publicClient } = useWallet();
  const [isPending, setIsPending] = useState(false);

  const subjectUri = `caip10:eip155:1:${address}`; // User's atom
  const predicateUri = `claims`; // We'll just use a raw string for predicate to keep it simple
  const objectUri = claimText;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !claimText || !walletClient || !publicClient) return;
    setIsPending(true);

    try {
      const patchedWalletClient = { ...walletClient, account: address };
      const config = { address: MULTIVAULT_ADDRESS, walletClient: patchedWalletClient as any, publicClient };

      // Step 1: Create Atoms (with zero deposit as per docs)
      // The SDK's createAtomFromString natively handles exists checks or just creating it
      const subjectAtom = await createAtomFromString(config, subjectUri);
      const predicateAtom = await createAtomFromString(config, predicateUri);
      const objectAtom = await createAtomFromString(config, objectUri);

      // Step 2: Create the actual Triple via SDK Quickstart
      await createTripleStatement(config, {
        args: [
          [subjectAtom.state.termId],
          [predicateAtom.state.termId],
          [objectAtom.state.termId],
          [parseEther('0.001')] // Initial deposit to satisfy the bonding curve minDeposit
        ],
        value: parseEther('0.001'), // Value to cover the deposit
      });

      setClaimText('');
      alert('Success! Your claim has been created. It will appear in the feed shortly once indexed.');
    } catch (e: any) {
      console.error(e);
      alert('Error creating claim: ' + e.message);
    }
    setIsPending(false);
  };

  if (!address) return null;

  return (
    <form onSubmit={handleCreate} className="bg-[#111] p-8 rounded-none border border-white/10 mb-8 relative group">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">Publish</h2>
      <div className="mb-6">
        <textarea
          value={claimText}
          onChange={(e) => setClaimText(e.target.value)}
          className="w-full px-4 py-4 bg-black/50 text-white border border-white/20 focus:border-white focus:ring-1 focus:ring-white transition-all outline-none resize-none font-mono text-sm placeholder:text-white/30"
          placeholder="ENTER STATEMENT..."
          rows={3}
        />
      </div>
      <button
        type="submit"
        disabled={isPending || !claimText}
        className="w-full bg-white text-black font-bold uppercase tracking-widest py-4 transition-all disabled:opacity-30 disabled:bg-white/20 disabled:text-white hover:bg-gray-200"
      >
        {isPending ? 'Processing...' : 'Submit to Ledger'}
      </button>
    </form>
  );
}

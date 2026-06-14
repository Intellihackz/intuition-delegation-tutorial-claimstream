'use client';

import { useWallet } from '@/lib/WalletContext';

export function ConnectButton() {
  const { address, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button
        onClick={disconnect}
        className="px-5 py-2.5 bg-transparent border border-white/20 text-white/70 hover:text-white hover:border-white rounded-none transition-all font-mono text-sm uppercase tracking-wider"
      >
        [{address.slice(0, 6)}...{address.slice(-4)}]
      </button>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-6 py-3 bg-white text-black hover:bg-white/90 rounded-none transition-colors font-bold uppercase tracking-widest text-sm"
    >
      Connect
    </button>
  );
}

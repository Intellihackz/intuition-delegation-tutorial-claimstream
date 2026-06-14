'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createWalletClient, custom, createPublicClient, http, WalletClient, PublicClient, Address, defineChain } from 'viem';

export const intuitionTestnet = defineChain({
  id: 13579,
  name: 'Intuition Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Intuition Testnet TRUST',
    symbol: 'tTRUST',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet.rpc.intuition.systems'],
      webSocket: ['wss://testnet.rpc.intuition.systems'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://testnet.explorer.intuition.systems' },
  },
});

interface WalletContextType {
  address: Address | null;
  walletClient: WalletClient | null;
  publicClient: PublicClient;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const publicClient = createPublicClient({
  chain: intuitionTestnet,
  transport: http(),
}) as PublicClient;

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const connect = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const client = createWalletClient({
          chain: intuitionTestnet,
          transport: custom((window as any).ethereum)
        });
        const [addr] = await client.requestAddresses();
        setAddress(addr);
        setWalletClient(client as WalletClient);
      } catch (e) {
        console.error(e);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const disconnect = () => {
    setAddress(null);
    setWalletClient(null);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) setAddress(accounts[0] as Address);
        else disconnect();
      };

      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  return (
    <WalletContext.Provider value={{ address, walletClient, publicClient, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};

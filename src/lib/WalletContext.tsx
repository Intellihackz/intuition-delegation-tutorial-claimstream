'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createWalletClient, custom, createPublicClient, http, WalletClient, PublicClient, Address, EIP1193Provider } from 'viem';

import { intuitionMainnet } from './chains';

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

interface WalletContextType {
  address: Address | null;
  walletClient: WalletClient | null;
  publicClient: PublicClient;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureChain: () => Promise<void>;
}

const publicClient = createPublicClient({
  chain: intuitionMainnet,
  transport: http(),
}) as PublicClient;

const WalletContext = createContext<WalletContextType | null>(null);

// viem wraps the raw EIP-1193 provider error in a chain of BaseErrors, so the
// 4902 ("Unrecognized chain ID") code can show up on the error itself or
// nested one level down in `.cause`.
function getErrorCode(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'number') return code;
  const cause = (err as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === 'number') return causeCode;
  }
  return undefined;
}

// Switch the connected wallet to Intuition Mainnet, adding it if MetaMask
// doesn't yet know about the chain (error 4902 = "Unrecognized chain ID").
async function switchToIntuition(client: WalletClient) {
  try {
    await client.switchChain({ id: intuitionMainnet.id });
  } catch (err) {
    const code = getErrorCode(err);
    const message = err instanceof Error ? err.message : '';
    if (code === 4902 || /Unrecognized chain|wallet_addEthereumChain/i.test(message)) {
      await client.addChain({ chain: intuitionMainnet });
      await client.switchChain({ id: intuitionMainnet.id });
    } else {
      throw err;
    }
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  const connect = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const ethereum = window.ethereum;
      try {
        const client = createWalletClient({
          chain: intuitionMainnet,
          transport: custom(ethereum)
        });
        const [addr] = await client.requestAddresses();

        // Create a new client specifically bound to the user's account
        // to prevent "Could not find an Account" errors in viem
        const boundClient = createWalletClient({
          account: addr,
          chain: intuitionMainnet,
          transport: custom(ethereum)
        });

        // Make sure the wallet is actually on Intuition Mainnet before we
        // hand the client to components that will send transactions.
        await switchToIntuition(client);
        setAddress(addr);
        setWalletClient(boundClient as WalletClient);
      } catch (e) {
        console.error(e);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  // Re-check the active chain right before sending a transaction, in case the
  // user switched networks in MetaMask after connecting.
  const ensureChain = async () => {
    if (!walletClient) throw new Error('Wallet not connected');
    await switchToIntuition(walletClient);
  };

  const disconnect = () => {
    setAddress(null);
    setWalletClient(null);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const ethereum = window.ethereum;
      const handleAccountsChanged = (accounts: Address[]) => {
        if (accounts.length > 0) setAddress(accounts[0]);
        else disconnect();
      };

      ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  return (
    <WalletContext.Provider value={{ address, walletClient, publicClient, connect, disconnect, ensureChain }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};

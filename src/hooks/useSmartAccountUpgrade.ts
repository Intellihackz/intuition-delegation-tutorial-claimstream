import { useState } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { signAuthorization } from 'viem/experimental';

export function useSmartAccountUpgrade() {
  const { walletClient, address } = useWallet();
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const upgrade = async () => {
    if (!walletClient || !address) {
      setError(new Error('Wallet not connected'));
      return;
    }

    try {
      setIsPending(true);
      setError(null);
      
      const authorization = await signAuthorization(walletClient, {
        account: address,
        contractAddress: '0x48dbe696A4D990079e039489ba2053b36E8FFEC4',
      });

      const hash = await walletClient.sendTransaction({
        account: address,
        to: address,
        data: '0x',
        authorizationList: [authorization],
      });

      setTxHash(hash);
      setIsSuccess(true);
    } catch (e: any) {
      console.error(e);
      setError(e instanceof Error ? e : new Error(e.message || 'Unknown error occurred'));
    } finally {
      setIsPending(false);
    }
  };

  return { upgrade, isPending, isSuccess, txHash, error };
}

import { useState } from 'react';
import { useWallet } from '@/lib/WalletContext';
import { sendCalls, waitForCallsStatus } from 'viem/actions';

export function useSmartAccountUpgrade() {
  const { walletClient, address, ensureChain } = useWallet();
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

      // Ensure the wallet is on Intuition Testnet before upgrading.
      await ensureChain();

      // EIP-5792: ask MetaMask to send a batch of calls. viem's signAuthorization
      // can't sign a 7702 authorization for an injected wallet — only local key
      // accounts — so we delegate the upgrade to the wallet itself.
      //
      // A *single* call needs no smart-account capability, so MetaMask would
      // just send a plain self-transfer and never upgrade. To force the 7702
      // upgrade we require ATOMIC execution of TWO calls: an EOA physically
      // cannot execute a multi-call atomic batch in one transaction, so MetaMask
      // must upgrade the account to a smart account (with the user's consent).
      // Omit `data` entirely — MetaMask rejects an empty "0x" (it requires at
      // least one hex digit), so value-only self-transfers of 0 are the no-ops.
      const { id } = await sendCalls(walletClient, {
        account: address,
        forceAtomic: true,
        calls: [
          { to: address, value: BigInt(0) },
          { to: address, value: BigInt(0) },
        ],
      });

      // Poll until the bundle is confirmed and pull the on-chain tx hash.
      const { receipts } = await waitForCallsStatus(walletClient, { id });
      const hash = receipts?.[0]?.transactionHash ?? null;

      setTxHash(hash);
      setIsSuccess(true);
    } catch (e: any) {
      console.error(e);
      // Older wallets without EIP-5792 support surface a method-not-found error.
      const message = /wallet_sendCalls|method not (found|supported)|Unsupported/i.test(e?.message ?? '')
        ? 'Your wallet does not support EIP-5792 batched calls. Update MetaMask to enable smart-account upgrades.'
        : (e?.message || 'Unknown error occurred');
      setError(e instanceof Error && !/wallet_sendCalls/i.test(e.message) ? e : new Error(message));
    } finally {
      setIsPending(false);
    }
  };

  return { upgrade, isPending, isSuccess, txHash, error };
}

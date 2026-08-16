import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/WalletContext';
import {
  Implementation,
  toMetaMaskSmartAccount,
  createDelegation,
  ScopeType,
  CaveatType,
  MetaMaskSmartAccount
} from '@metamask/smart-accounts-kit';
import { encodeAbiParameters, encodeFunctionData, parseEther, type Address, createWalletClient, custom, toFunctionSelector } from 'viem';
import { MULTIVAULT, DEPOSIT_SIG, DEPOSIT_OFFSET, multiVaultAbi, ApprovalType } from '@/lib/constants';
import { intuitionMainnet } from '@/lib/chains';

// The address derived from ADMIN_PRIVATE_KEY. Must be overridden via
// NEXT_PUBLIC_ADMIN_ADDRESS if you use your own admin wallet, or delegations
// will be signed for a relayer that can't redeem them.
export const ADMIN_DELEGATEE: Address =
  (process.env.NEXT_PUBLIC_ADMIN_ADDRESS as Address) || '0x9c103d804bc1867F429a37707Dc5d5C9b29D7a6C';
const getStorageKey = (addr: string) => `intuition_admin_delegation_${addr.toLowerCase()}`;
const getBudgetStorageKey = (addr: string) => `intuition_admin_budget_${addr.toLowerCase()}`;

export function useAdminDelegation() {
  const { walletClient, publicClient, address, ensureChain } = useWallet();
  const [smartAccount, setSmartAccount] = useState<MetaMaskSmartAccount | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [delegation, setDelegation] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hsaBalance, setHsaBalance] = useState<bigint | null>(null);
  const [initialBudget, setInitialBudget] = useState<string>('0');

  // Load existing delegation from local storage
  useEffect(() => {
    if (!address) {
      queueMicrotask(() => {
        setDelegation(null);
        setInitialBudget('0');
      });
      return;
    }
    const saved = localStorage.getItem(getStorageKey(address));
    if (saved) {
      try {
        const parsed = JSON.parse(saved, (key, value) =>
          typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value
        );
        const savedBudget = localStorage.getItem(getBudgetStorageKey(address)) ?? '1';
        queueMicrotask(() => {
          setDelegation(parsed);
          setInitialBudget(savedBudget);
        });
      } catch (e) {
        console.error('Failed to parse saved delegation', e);
        queueMicrotask(() => {
          setDelegation(null);
          setInitialBudget('0');
        });
      }
    } else {
      queueMicrotask(() => {
        setDelegation(null);
        setInitialBudget('0');
      });
    }
  }, [address]);

  // Fetch HSA balance
  useEffect(() => {
    if (!delegation || !smartAccount || !publicClient) {
      queueMicrotask(() => setHsaBalance(null));
      return;
    }
    let isMounted = true;
    const fetchBalance = async () => {
      try {
        const bal = await publicClient.getBalance({ address: smartAccount.address });
        if (isMounted) setHsaBalance(bal);
      } catch {}
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 5000); // Poll every 5s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [delegation, smartAccount, publicClient]);

  // Initialize the HSA instance (this does not deploy it on-chain yet)
  useEffect(() => {
    async function init() {
      if (!address || !walletClient || !publicClient) return;
      try {
        const patchedClient = createWalletClient({
          account: address,
          chain: intuitionMainnet,
          transport: custom((window as unknown as { ethereum: Parameters<typeof custom>[0] }).ethereum)
        });

        const sa = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [address, [], [], []],
          deploySalt: '0x',
          signer: { walletClient: patchedClient },
        });
        setSmartAccount(sa);
      } catch (e) {
        console.error('Failed to initialize Hybrid Smart Account:', e);
      }
    }
    init();
  }, [address, walletClient, publicClient]);

  const setupDelegation = async (budgetTrust: string = '5', maxCalls: number = 100) => {
    if (!smartAccount || !address || !walletClient || !publicClient) {
      setError('Wallet not fully connected or Smart Account not initialized.');
      return;
    }

    try {
      setIsDeploying(true);
      setError(null);
      await ensureChain();

      // 1. Deploy the HSA if not deployed
      const isDeployed = await smartAccount.isDeployed();
      if (!isDeployed) {
        console.log('Deploying HSA...');
        const { factory, factoryData } = await smartAccount.getFactoryArgs();
        if (factory && factoryData) {
          const hash = await walletClient.sendTransaction({
            account: address,
            to: factory,
            data: factoryData,
            chain: intuitionMainnet,
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }

      // 2. Fund the HSA (the "budget" for staking)
      const saBal = await publicClient.getBalance({ address: smartAccount.address });
      const budgetWei = parseEther(budgetTrust);
      if (saBal < budgetWei) {
        console.log(`Funding HSA with ${budgetTrust} TRUST...`);
        const hash = await walletClient.sendTransaction({
          account: address,
          to: smartAccount.address,
          value: budgetWei - saBal,
          chain: intuitionMainnet,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }

      // 3. Approve the MultiVault to use HSA funds for staking
      // (The user's EOA signs the approval for the HSA so the HSA can deposit in the EOA's name)
      console.log('Approving MultiVault...');
      const approveHash = await walletClient.sendTransaction({
        account: address,
        to: MULTIVAULT,
        data: encodeFunctionData({
          abi: multiVaultAbi,
          functionName: 'approve',
          args: [smartAccount.address, ApprovalType.DEPOSIT],
        }),
        chain: intuitionMainnet,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 4. Create Delegation with strict caveats
      const expiry = Math.floor(Date.now() / 1000) + 30 * 86400; // 30 days
      const newDelegation = createDelegation({
        from: smartAccount.address,
        to: ADMIN_DELEGATEE,
        environment: smartAccount.environment,
        scope: {
          type: ScopeType.NativeTokenTransferAmount,
          maxAmount: budgetWei,
          allowedCalldata: [
            // Pin the receiver argument so stakes are ALWAYS credited to the user's main wallet.
            // Notice we do NOT pin the termId here so the admin can stake on any claim for the user.
            {
              startIndex: DEPOSIT_OFFSET.receiver,
              value: encodeAbiParameters([{ type: 'address' }], [address]),
            },
          ],
        },
        caveats: [
          { type: CaveatType.AllowedTargets, targets: [MULTIVAULT] },
          { type: CaveatType.AllowedMethods, selectors: [toFunctionSelector(DEPOSIT_SIG)] },
          { type: CaveatType.LimitedCalls, limit: maxCalls },
          { type: CaveatType.Timestamp, afterThreshold: 0, beforeThreshold: expiry },
        ],
      });

      // 5. Sign the Delegation
      console.log('Signing Delegation...');
      const signature = await smartAccount.signDelegation({ delegation: newDelegation });
      const signedDelegation = { ...newDelegation, signature };

      // 6. Save it
      setDelegation(signedDelegation);
      localStorage.setItem(getStorageKey(address), JSON.stringify(signedDelegation, (key, value) =>
        typeof value === 'bigint' ? value.toString() + 'n' : value
      ));
      localStorage.setItem(getBudgetStorageKey(address), budgetTrust);
      setInitialBudget(budgetTrust);
      console.log('Setup complete!');

    } catch (e: unknown) {
      console.error(e);
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage ?? err.message ?? 'An error occurred during setup');
    } finally {
      setIsDeploying(false);
    }
  };

  const clearDelegation = () => {
    setDelegation(null);
    setHsaBalance(null);
    setInitialBudget('0');
    if (address) {
      localStorage.removeItem(getStorageKey(address));
      localStorage.removeItem(getBudgetStorageKey(address));
    }
  };

  const revokeDelegation = async () => {
    if (!smartAccount || !walletClient || !publicClient || !address) return;
    try {
      setIsDeploying(true);
      setError(null);
      await ensureChain();

      console.log('Revoking MultiVault approval...');
      const hash = await walletClient.sendTransaction({
        account: address,
        to: MULTIVAULT,
        data: encodeFunctionData({
          abi: multiVaultAbi,
          functionName: 'approve',
          args: [smartAccount.address, ApprovalType.NONE],
        }),
        chain: intuitionMainnet,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      clearDelegation();
      console.log('Delegation successfully revoked on-chain.');
    } catch (e: unknown) {
      console.error(e);
      const err = e as { shortMessage?: string; message?: string };
      setError(err.shortMessage ?? err.message ?? 'Failed to revoke delegation');
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    smartAccount,
    delegation,
    isDeploying,
    error,
    setupDelegation,
    clearDelegation,
    revokeDelegation,
    hsaBalance,
    initialBudget
  };
}

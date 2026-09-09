import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/lib/WalletContext';
import {
  Implementation,
  toMetaMaskSmartAccount,
  createDelegation,
  createExecution,
  ExecutionMode,
  ScopeType,
  CaveatType,
  MetaMaskSmartAccount
} from '@metamask/smart-accounts-kit';
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts';
import { getNativeTokenPeriodTransferEnforcerAvailableAmount } from '@metamask/smart-accounts-kit/actions';
import { encodeAbiParameters, encodeFunctionData, parseEther, type Address, createWalletClient, custom, toFunctionSelector } from 'viem';
import { MULTIVAULT, DELEGATION_MANAGER, DEPOSIT_SIG, DEPOSIT_OFFSET, multiVaultAbi, ApprovalType, BUDGET_PERIOD_SECONDS } from '@/lib/constants';
import { intuitionMainnet } from '@/lib/chains';

// The address derived from ADMIN_PRIVATE_KEY. Must be overridden via
// NEXT_PUBLIC_ADMIN_ADDRESS if you use your own admin wallet, or delegations
// will be signed for a relayer that can't redeem them.
export const ADMIN_DELEGATEE: Address =
  (process.env.NEXT_PUBLIC_ADMIN_ADDRESS as Address) || '0x9c103d804bc1867F429a37707Dc5d5C9b29D7a6C';
const getStorageKey = (addr: string) => `intuition_admin_delegation_${addr.toLowerCase()}`;
const getBudgetStorageKey = (addr: string) => `intuition_admin_budget_${addr.toLowerCase()}`;
const getWizardKey = (addr: string) => `intuition_admin_wizard_${addr.toLowerCase()}`;

// Per-address budget metadata saved alongside the delegation. `dailyCap` is the
// TRUST the relayer may spend per window; `periodStart` is the unix second the
// first window opened, used to show when the allowance next resets.
type BudgetMeta = { dailyCap: string; periodStart: number };

// The four one-time setup steps. The user runs them one at a time.
export type WizardStepKey = 'deploy' | 'fund' | 'approve' | 'sign';
export type WizardProgress = { deployed: boolean; funded: boolean; approved: boolean };

export const SETUP_STEPS: {
  key: WizardStepKey;
  title: string;
  action: string;
  detail: string;
}[] = [
  {
    key: 'deploy',
    title: 'Deploy Smart Account',
    action: 'Deploy',
    detail:
      'An ERC-7702 upgrade gives your existing wallet address smart-account code. Same address, no funds moved. One-time.',
  },
  {
    key: 'fund',
    title: 'Fund the Smart Account',
    action: 'Fund',
    detail:
      'Move TRUST from your wallet into the HSA. This is the balance the relayer stakes from; the daily cap limits how fast it can be spent.',
  },
  {
    key: 'approve',
    title: 'Approve the MultiVault',
    action: 'Approve',
    detail:
      'Your wallet calls multiVault.approve(HSA, DEPOSIT) so the relayer can deposit with you as the receiver — shares are always credited to your wallet, never the HSA.',
  },
  {
    key: 'sign',
    title: 'Sign the delegation',
    action: 'Sign delegation',
    detail:
      'An off-chain signature (no gas) scoping the relayer to deposit-only, your address as receiver, a per-day TRUST cap, and a 30-day expiry.',
  },
];

const EMPTY_WIZARD: WizardProgress = { deployed: false, funded: false, approved: false };

function parseBudgetMeta(raw: string | null): BudgetMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'dailyCap' in parsed) {
      return { dailyCap: String(parsed.dailyCap), periodStart: Number(parsed.periodStart) || 0 };
    }
    // Legacy value: a bare budget string with no window info.
    return { dailyCap: String(parsed), periodStart: 0 };
  } catch {
    return { dailyCap: raw, periodStart: 0 };
  }
}

function parseWizard(raw: string | null): WizardProgress {
  if (!raw) return EMPTY_WIZARD;
  try {
    const p = JSON.parse(raw);
    return { deployed: !!p?.deployed, funded: !!p?.funded, approved: !!p?.approved };
  } catch {
    return EMPTY_WIZARD;
  }
}

function errMessage(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string };
  return err.shortMessage ?? err.message ?? 'Something went wrong';
}

export function useAdminDelegation() {
  const { walletClient, publicClient, address, ensureChain } = useWallet();
  const [smartAccount, setSmartAccount] = useState<MetaMaskSmartAccount | null>(null);
  const [busyStep, setBusyStep] = useState<WizardStepKey | 'revoke' | null>(null);
  const [delegation, setDelegation] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hsaBalance, setHsaBalance] = useState<bigint | null>(null);
  const [budgetMeta, setBudgetMeta] = useState<BudgetMeta | null>(null);
  const [periodAvailable, setPeriodAvailable] = useState<bigint | null>(null);
  const [periodResetsAt, setPeriodResetsAt] = useState<number | null>(null);
  const [wizard, setWizard] = useState<WizardProgress>(EMPTY_WIZARD);

  // Merge a patch into the wizard progress and persist it (functional update so
  // concurrent steps never clobber each other).
  const patchWizard = useCallback(
    (patch: Partial<WizardProgress>) => {
      setWizard((prev) => {
        const next = { ...prev, ...patch };
        if (address) localStorage.setItem(getWizardKey(address), JSON.stringify(next));
        return next;
      });
    },
    [address],
  );

  // Load existing delegation + wizard progress from local storage
  useEffect(() => {
    if (!address) {
      queueMicrotask(() => {
        setDelegation(null);
        setBudgetMeta(null);
        setWizard(EMPTY_WIZARD);
      });
      return;
    }
    const wiz = parseWizard(localStorage.getItem(getWizardKey(address)));
    const saved = localStorage.getItem(getStorageKey(address));
    if (saved) {
      try {
        const parsed = JSON.parse(saved, (key, value) =>
          typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value
        );
        const meta = parseBudgetMeta(localStorage.getItem(getBudgetStorageKey(address)));
        queueMicrotask(() => {
          setDelegation(parsed);
          setBudgetMeta(meta);
          setWizard(wiz);
        });
      } catch (e) {
        console.error('Failed to parse saved delegation', e);
        queueMicrotask(() => {
          setDelegation(null);
          setBudgetMeta(null);
          setWizard(wiz);
        });
      }
    } else {
      queueMicrotask(() => {
        setDelegation(null);
        setBudgetMeta(null);
        setWizard(wiz);
      });
    }
  }, [address]);

  // If the HSA is already deployed on-chain (a previous visit, or deployed by
  // another dApp), mark step 1 done so the wizard resumes at the right place.
  useEffect(() => {
    if (!smartAccount || wizard.deployed) return;
    let cancelled = false;
    smartAccount
      .isDeployed()
      .then((dep) => {
        if (!cancelled && dep) patchWizard({ deployed: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [smartAccount, wizard.deployed, patchWizard]);

  // Poll the HSA balance once the account is deployed (so funding is visible
  // during the wizard, not just after the delegation is signed).
  useEffect(() => {
    if (!smartAccount || !publicClient || (!delegation && !wizard.deployed)) {
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
    const interval = setInterval(fetchBalance, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [delegation, smartAccount, publicClient, wizard.deployed]);

  // Track how much of the current window's allowance is still available. The
  // NativeTokenPeriodTransferEnforcer stores nothing until the first redemption,
  // so before then we just show the full daily cap.
  useEffect(() => {
    if (!delegation || !smartAccount || !publicClient) {
      queueMicrotask(() => {
        setPeriodAvailable(null);
        setPeriodResetsAt(null);
      });
      return;
    }
    let isMounted = true;
    const refresh = async () => {
      // When the current window rolls over (and the allowance refills).
      if (budgetMeta && budgetMeta.periodStart > 0) {
        const now = Math.floor(Date.now() / 1000);
        const periodsDone =
          Math.floor(Math.max(0, now - budgetMeta.periodStart) / BUDGET_PERIOD_SECONDS) + 1;
        if (isMounted) setPeriodResetsAt(budgetMeta.periodStart + periodsDone * BUDGET_PERIOD_SECONDS);
      }
      try {
        const res = await getNativeTokenPeriodTransferEnforcerAvailableAmount(
          publicClient,
          smartAccount.environment,
          { delegation: delegation as Parameters<typeof getNativeTokenPeriodTransferEnforcerAvailableAmount>[2]['delegation'] }
        );
        if (isMounted) setPeriodAvailable(res.availableAmount);
      } catch {
        // The enforcer stores nothing until the first redemption -- full cap is available.
        if (isMounted && budgetMeta) {
          try {
            setPeriodAvailable(parseEther(budgetMeta.dailyCap));
          } catch {}
        }
      }
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [delegation, smartAccount, publicClient, budgetMeta]);

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

  // --- Step 1: deploy the Hybrid Smart Account (ERC-7702 upgrade) ---
  const deployHsa = async () => {
    if (!smartAccount || !address || !walletClient || !publicClient) {
      setError('Wallet not fully connected or Smart Account not initialized.');
      return;
    }
    try {
      setBusyStep('deploy');
      setError(null);
      await ensureChain();
      if (!(await smartAccount.isDeployed())) {
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
      patchWizard({ deployed: true });
    } catch (e: unknown) {
      console.error(e);
      setError(errMessage(e));
    } finally {
      setBusyStep(null);
    }
  };

  // --- Step 2: fund the HSA with the total staking balance ---
  const fundHsa = async (prefundTrust: string) => {
    if (!smartAccount || !address || !walletClient || !publicClient) {
      setError('Wallet not fully connected or Smart Account not initialized.');
      return;
    }
    let prefundWei: bigint;
    try {
      prefundWei = parseEther(prefundTrust || '0');
    } catch {
      setError('Enter a valid TRUST amount.');
      return;
    }
    if (prefundWei <= BigInt(0)) {
      setError('Enter an amount to fund.');
      return;
    }
    try {
      setBusyStep('fund');
      setError(null);
      await ensureChain();
      const saBal = await publicClient.getBalance({ address: smartAccount.address });
      if (saBal < prefundWei) {
        const hash = await walletClient.sendTransaction({
          account: address,
          to: smartAccount.address,
          value: prefundWei - saBal,
          chain: intuitionMainnet,
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }
      patchWizard({ funded: true });
    } catch (e: unknown) {
      console.error(e);
      setError(errMessage(e));
    } finally {
      setBusyStep(null);
    }
  };

  // --- Step 3: approve the HSA to deposit on the EOA's behalf ---
  // multiVault.approve(HSA, DEPOSIT) so the relayer's delegated deposit(receiver
  // = EOA) calls are accepted and credit shares to the EOA, not the HSA. The
  // MultiVault never moves the HSA's funds itself.
  const approveMultiVault = async () => {
    if (!smartAccount || !address || !walletClient || !publicClient) {
      setError('Wallet not fully connected or Smart Account not initialized.');
      return;
    }
    try {
      setBusyStep('approve');
      setError(null);
      await ensureChain();
      const hash = await walletClient.sendTransaction({
        account: address,
        to: MULTIVAULT,
        data: encodeFunctionData({
          abi: multiVaultAbi,
          functionName: 'approve',
          args: [smartAccount.address, ApprovalType.DEPOSIT],
        }),
        chain: intuitionMainnet,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      patchWizard({ approved: true });
    } catch (e: unknown) {
      console.error(e);
      setError(errMessage(e));
    } finally {
      setBusyStep(null);
    }
  };

  // --- Step 4: build + sign the scoped delegation (off-chain, no gas) ---
  const signDelegation = async (dailyCapTrust: string, maxCalls: number = 100) => {
    if (!smartAccount || !address || !publicClient) {
      setError('Wallet not fully connected or Smart Account not initialized.');
      return;
    }
    let dailyCapWei: bigint;
    try {
      dailyCapWei = parseEther(dailyCapTrust || '0');
    } catch {
      setError('Enter a valid daily limit.');
      return;
    }
    if (dailyCapWei <= BigInt(0)) {
      setError('Enter a daily limit.');
      return;
    }
    try {
      setBusyStep('sign');
      setError(null);
      await ensureChain();

      const periodStart = Math.floor(Date.now() / 1000);
      const expiry = periodStart + 30 * 86400; // 30 days
      const newDelegation = createDelegation({
        from: smartAccount.address,
        to: ADMIN_DELEGATEE,
        environment: smartAccount.environment,
        scope: {
          // Cap native TRUST spend per rolling window instead of over the
          // delegation's whole lifetime. The enforcer resets the allowance
          // automatically each window, so the user never has to re-delegate.
          type: ScopeType.NativeTokenPeriodTransfer,
          periodAmount: dailyCapWei,
          periodDuration: BUDGET_PERIOD_SECONDS,
          startDate: periodStart,
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

      const signature = await smartAccount.signDelegation({ delegation: newDelegation });
      const signedDelegation = { ...newDelegation, signature };

      setDelegation(signedDelegation);
      localStorage.setItem(getStorageKey(address), JSON.stringify(signedDelegation, (key, value) =>
        typeof value === 'bigint' ? value.toString() + 'n' : value
      ));
      const meta: BudgetMeta = { dailyCap: dailyCapTrust, periodStart };
      localStorage.setItem(getBudgetStorageKey(address), JSON.stringify(meta));
      setBudgetMeta(meta);
    } catch (e: unknown) {
      console.error(e);
      setError(errMessage(e));
    } finally {
      setBusyStep(null);
    }
  };

  const clearDelegation = () => {
    setDelegation(null);
    setHsaBalance(null);
    setBudgetMeta(null);
    setPeriodAvailable(null);
    setPeriodResetsAt(null);
    setWizard(EMPTY_WIZARD);
    if (address) {
      localStorage.removeItem(getStorageKey(address));
      localStorage.removeItem(getBudgetStorageKey(address));
      localStorage.removeItem(getWizardKey(address));
    }
  };

  const revokeDelegation = async () => {
    if (!smartAccount || !walletClient || !publicClient || !address) return;
    try {
      setBusyStep('revoke');
      setError(null);
      await ensureChain();

      // Sweep any remaining HSA balance back to the EOA first. The HSA's own
      // execute() only accepts calls from the ERC-4337 EntryPoint or itself,
      // so the owner can't just call it directly to move funds out. Instead
      // we sign a one-time self-delegation for the full balance and redeem
      // it ourselves -- the exact same delegation mechanism the relayer uses
      // for staking, just invoked directly by the owner instead.
      const remainingBalance = await publicClient.getBalance({ address: smartAccount.address });
      if (remainingBalance > BigInt(0)) {
        console.log(`Sweeping ${remainingBalance} wei back to EOA...`);
        const sweepDelegation = createDelegation({
          from: smartAccount.address,
          to: address,
          environment: smartAccount.environment,
          scope: {
            type: ScopeType.NativeTokenTransferAmount,
            maxAmount: remainingBalance,
          },
          caveats: [],
        });
        const sweepSignature = await smartAccount.signDelegation({ delegation: sweepDelegation });
        const signedSweep = { ...sweepDelegation, signature: sweepSignature };

        const sweepHash = await walletClient.sendTransaction({
          account: address,
          to: DELEGATION_MANAGER,
          data: DelegationManager.encode.redeemDelegations({
            delegations: [[signedSweep]],
            modes: [ExecutionMode.SingleDefault],
            executions: [[createExecution({ target: address, value: remainingBalance })]],
          }),
          chain: intuitionMainnet,
        });
        await publicClient.waitForTransactionReceipt({ hash: sweepHash });
      }

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
      // The HSA contract stays deployed; only the funding and approval are gone,
      // so re-enabling starts the wizard at "fund".
      patchWizard({ deployed: true });
      console.log('Delegation successfully revoked on-chain.');
    } catch (e: unknown) {
      console.error(e);
      setError(errMessage(e));
    } finally {
      setBusyStep(null);
    }
  };

  return {
    smartAccount,
    delegation,
    error,
    busyStep,
    isBusy: busyStep !== null,
    wizard,
    deployHsa,
    fundHsa,
    approveMultiVault,
    signDelegation,
    clearDelegation,
    revokeDelegation,
    hsaBalance,
    dailyCap: budgetMeta?.dailyCap ?? '0',
    periodAvailable,
    periodResetsAt,
  };
}

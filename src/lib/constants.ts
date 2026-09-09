import { type Address } from 'viem';

export const MULTIVAULT: Address = '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e';
export const DELEGATION_MANAGER: Address = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';
export const DEPOSIT_SIG = 'deposit(address,bytes32,uint256,uint256)';
export const DEPOSIT_OFFSET = { receiver: 4, termId: 36, curveId: 68, minShares: 100 } as const;
// MultiVault approval flags (bitfield: DEPOSIT = 0b01, REDEMPTION = 0b10).
// We only grant DEPOSIT — it lets the HSA open/add to positions crediting the
// EOA. REDEMPTION would additionally let the delegate close the EOA's positions
// (proceeds still go to the EOA); BOTH sets both bits. This app never unstakes,
// so we keep it to the minimum.
export const ApprovalType = { NONE: 0, DEPOSIT: 1, REDEMPTION: 2, BOTH: 3 } as const;

// The rolling window the delegated staking budget is capped over. The
// NativeTokenPeriodTransfer caveat lets the relayer spend up to the chosen
// amount per window, then resets automatically on the next window.
export const BUDGET_PERIOD_SECONDS = 86_400; // 1 day

// The Intuition chain's block.timestamp can trail wall-clock time by a couple
// of minutes. We backdate the period's startDate by this much so the very
// first delegated deposit doesn't revert with
// `NativeTokenPeriodTransferEnforcer:transfer-not-started` while the chain
// catches up. Cost is purely cosmetic: the first window is ~1h short.
export const BUDGET_START_BACKDATE_SECONDS = 3_600; // 1 hour

export const multiVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [
      { name: 'receiver', type: 'address' },
      { name: 'termId', type: 'bytes32' },
      { name: 'curveId', type: 'uint256' },
      { name: 'minShares', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'sender', type: 'address' },
      { name: 'approvalType', type: 'uint8' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'previewDeposit',
    stateMutability: 'view',
    inputs: [
      { name: 'termId', type: 'bytes32' },
      { name: 'curveId', type: 'uint256' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'assetsAfterFees', type: 'uint256' },
    ],
  },
] as const;

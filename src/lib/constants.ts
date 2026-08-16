import { type Address } from 'viem';

export const MULTIVAULT: Address = '0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e';
export const DELEGATION_MANAGER: Address = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3';
export const DEPOSIT_SIG = 'deposit(address,bytes32,uint256,uint256)';
export const DEPOSIT_OFFSET = { receiver: 4, termId: 36, curveId: 68, minShares: 100 } as const;
export const ApprovalType = { NONE: 0, DEPOSIT: 1, REDEMPTION: 2, BOTH: 3 } as const;

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

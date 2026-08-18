import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { intuitionMainnet } from '@/lib/chains';
import { MULTIVAULT, DELEGATION_MANAGER, multiVaultAbi } from '@/lib/constants';
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts';
import { createExecution, ExecutionMode } from '@metamask/smart-accounts-kit';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const { delegation, termId, curveId, assets, userAddress } = JSON.parse(rawBody, (key, value) =>
      typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value
    );

    if (!delegation || !termId || curveId === undefined || !assets || !userAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      return NextResponse.json({ error: 'Admin wallet not configured' }, { status: 500 });
    }

    const adminAccount = privateKeyToAccount(adminPrivateKey as `0x${string}`);
    const publicClient = createPublicClient({ chain: intuitionMainnet, transport: http() });
    const walletClient = createWalletClient({ account: adminAccount, chain: intuitionMainnet, transport: http() });

    // 1. Calculate minShares (1% slippage tolerance)
    const [shares] = await publicClient.readContract({
      address: MULTIVAULT,
      abi: multiVaultAbi,
      functionName: 'previewDeposit',
      args: [termId, BigInt(curveId), BigInt(assets)],
    });
    const minShares = (shares * 99n) / 100n;

    // 2. Encode the MultiVault deposit call
    const callData = encodeFunctionData({
      abi: multiVaultAbi,
      functionName: 'deposit',
      // The receiver MUST match the one pinned in the delegation's caveats (the user's address)
      args: [userAddress, termId, BigInt(curveId), minShares],
    });

    // 3. Encode the DelegationManager redeem call
    const target = DELEGATION_MANAGER;
    const data = DelegationManager.encode.redeemDelegations({
      delegations: [[delegation]],
      modes: [ExecutionMode.SingleDefault],
      executions: [[createExecution({ target: MULTIVAULT, value: BigInt(assets), callData })]],
    });

    // 4. (Optional but recommended) Dry-run to catch revert reasons
    try {
      await publicClient.call({ account: adminAccount.address, to: target, data });
    } catch (simErr: any) {
      console.error('Simulation failed:', simErr);
      return NextResponse.json({ 
        error: 'Transaction simulation failed (e.g., budget exhausted or caveat violated)', 
        details: simErr.shortMessage ?? simErr.message 
      }, { status: 400 });
    }

    // 5. Execute the transaction!
    const hash = await walletClient.sendTransaction({ to: target, data });
    
    // We can choose to wait for the receipt, or return the hash immediately so the UI feels instant.
    // Returning immediately so the delegated stake feels instant.
    return NextResponse.json({ success: true, hash });

  } catch (error: any) {
    console.error('API Stake Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

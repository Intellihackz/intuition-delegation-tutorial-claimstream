import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { intuitionMainnet } from '@/lib/chains';
import { MULTIVAULT, DELEGATION_MANAGER, multiVaultAbi } from '@/lib/constants';
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts';
import { createExecution, ExecutionMode } from '@metamask/smart-accounts-kit';

const publicClient = createPublicClient({ chain: intuitionMainnet, transport: http() });

// The relayer has ONE nonce sequence. A user clicking fast across several claims
// fires several /api/stake calls at once; if two of them read the same nonce,
// the second transaction reverts with "nonce too low". We serialize the
// read-nonce-then-send step in a promise chain and track the nonce in memory so
// a not-yet-propagated pending tx doesn't leave a gap. (In a multi-instance
// deployment each instance has its own chain — a shared nonce service or a
// single relayer worker would be the production answer.)
let relayerChain: Promise<unknown> = Promise.resolve();
let managedNonce: number | null = null;

async function sendFromRelayer(
  account: ReturnType<typeof privateKeyToAccount>,
  tx: { to: `0x${string}`; data: `0x${string}` },
): Promise<`0x${string}`> {
  const walletClient = createWalletClient({ account, chain: intuitionMainnet, transport: http() });
  const run = async () => {
    const chainNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
    const nonce = managedNonce === null ? chainNonce : Math.max(chainNonce, managedNonce);
    managedNonce = nonce + 1;
    try {
      return await walletClient.sendTransaction({ ...tx, nonce });
    } catch (e) {
      // The send failed, so that nonce was never used — re-read from chain next time.
      managedNonce = null;
      throw e;
    }
  };
  const result = relayerChain.then(run, run);
  relayerChain = result.catch(() => {}); // keep the chain alive after a failure
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    // BigInt values in the delegation were serialized as strings ending in "n".
    const {
      delegation,
      termId,
      curveId,
      assets,
      userAddress,
      action = 'deposit',
    } = JSON.parse(rawBody, (key, value) =>
      typeof value === 'string' && /^\d+n$/.test(value) ? BigInt(value.slice(0, -1)) : value
    );

    if (!delegation || !termId || curveId === undefined || !userAddress) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    if (action !== 'deposit' && action !== 'redeem') {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    if (action === 'deposit' && !assets) {
      return NextResponse.json({ error: 'Missing assets for deposit' }, { status: 400 });
    }

    const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminPrivateKey) {
      return NextResponse.json({ error: 'Admin wallet not configured' }, { status: 500 });
    }

    const adminAccount = privateKeyToAccount(adminPrivateKey as `0x${string}`);

    const cid = BigInt(curveId);
    let callData: `0x${string}`;
    let value = BigInt(0);

    if (action === 'deposit') {
      // minShares with 1% slippage tolerance
      const [shares] = await publicClient.readContract({
        address: MULTIVAULT,
        abi: multiVaultAbi,
        functionName: 'previewDeposit',
        args: [termId, cid, BigInt(assets)],
      });
      const minShares = (shares * 99n) / 100n;
      // The receiver MUST match the address pinned in the delegation's caveats.
      callData = encodeFunctionData({
        abi: multiVaultAbi,
        functionName: 'deposit',
        args: [userAddress, termId, cid, minShares],
      });
      value = BigInt(assets);
    } else {
      // redeem: close the user's whole position on this term
      const shares = await publicClient.readContract({
        address: MULTIVAULT,
        abi: multiVaultAbi,
        functionName: 'getShares',
        args: [userAddress, termId, cid],
      });
      if (shares === 0n) {
        return NextResponse.json({ error: 'No position to withdraw on this term' }, { status: 400 });
      }
      const [assetsAfterFees] = await publicClient.readContract({
        address: MULTIVAULT,
        abi: multiVaultAbi,
        functionName: 'previewRedeem',
        args: [termId, cid, shares],
      });
      const minAssets = (assetsAfterFees * 99n) / 100n;
      // redeem() sends the withdrawn TRUST to the receiver (the user), never the caller.
      callData = encodeFunctionData({
        abi: multiVaultAbi,
        functionName: 'redeem',
        args: [userAddress, termId, cid, shares, minAssets],
      });
      // value stays 0 — a redemption doesn't touch the delegation's TRUST cap.
    }

    // Encode the DelegationManager redeem call
    const target = DELEGATION_MANAGER;
    const data = DelegationManager.encode.redeemDelegations({
      delegations: [[delegation]],
      modes: [ExecutionMode.SingleDefault],
      executions: [[createExecution({ target: MULTIVAULT, value, callData })]],
    });

    // Dry-run to surface revert reasons before spending gas
    try {
      await publicClient.call({ account: adminAccount.address, to: target, data });
    } catch (simErr: unknown) {
      console.error('Simulation failed:', simErr);
      const e = simErr as { shortMessage?: string; message?: string };
      return NextResponse.json(
        { error: 'Transaction simulation failed', details: e.shortMessage ?? e.message },
        { status: 400 },
      );
    }

    const hash = await sendFromRelayer(adminAccount, { to: target, data });
    return NextResponse.json({ success: true, hash, action });
  } catch (error: unknown) {
    console.error('API Stake Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

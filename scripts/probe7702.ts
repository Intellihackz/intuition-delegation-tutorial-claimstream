/**
 * Probe whether Intuition Testnet supports EIP-7702 at the node level.
 *
 * Runs the same local-key upgrade as testLocalFlow.ts but in isolation: it signs
 * an authorization, sends the type-4 self-transaction, then reads the account
 * code back. It does NOT create or revoke any delegation.
 *
 * Usage:  PROBE_PRIVATE_KEY=0x<funded testnet eoa key> npx tsx scripts/probe7702.ts
 * (falls back to TEST_DELEGATOR_PRIVATE_KEY if PROBE_PRIVATE_KEY is unset)
 */
import { createWalletClient, createPublicClient, http, encodeFunctionData, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { signAuthorization } from 'viem/experimental';
import { intuitionTestnet } from '../src/lib/chains';
import { config } from 'dotenv';

config();

const RPC_URL = process.env.NEXT_PUBLIC_INTUITION_RPC || 'https://testnet.rpc.intuition.systems';
const HYBRID_DELEGATOR = '0x48dbe696A4D990079e039489ba2053b36E8FFEC4' as const;

const hybridDeleGatorAbi = [{
  name: 'initialize', type: 'function',
  inputs: [
    { name: 'owners', type: 'address[]' },
    { name: 'guardians', type: 'address[]' },
    { name: 'approvals', type: 'uint256[]' },
    { name: 'keys', type: 'bytes[]' },
  ],
  outputs: [],
}] as const;

async function main() {
  const key = (process.env.PROBE_PRIVATE_KEY || process.env.TEST_DELEGATOR_PRIVATE_KEY) as Hex | undefined;
  if (!key) throw new Error('Set PROBE_PRIVATE_KEY (or TEST_DELEGATOR_PRIVATE_KEY) to a funded testnet EOA key');

  const account = privateKeyToAccount(key);
  const publicClient = createPublicClient({ chain: intuitionTestnet, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: intuitionTestnet, transport: http(RPC_URL) });

  console.log(`Probing EIP-7702 on chain ${intuitionTestnet.id} with ${account.address}`);
  console.log(`Balance: ${await publicClient.getBalance({ address: account.address })} wei`);
  console.log(`Code BEFORE: ${await publicClient.getCode({ address: account.address }) ?? '0x'}`);

  const authorization = await signAuthorization(walletClient, {
    account,
    contractAddress: HYBRID_DELEGATOR,
  });

  const initData = encodeFunctionData({
    abi: hybridDeleGatorAbi,
    functionName: 'initialize',
    args: [[account.address], [], [], []],
  });

  const hash = await walletClient.sendTransaction({
    account,
    to: account.address,
    data: initData,
    authorizationList: [authorization],
  });
  console.log(`Upgrade tx: ${hash}`);
  console.log(`Explorer:   https://testnet.explorer.intuition.systems/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const codeAfter = await publicClient.getCode({ address: account.address }) ?? '0x';
  console.log(`Receipt status: ${receipt.status} (type: ${receipt.type})`);
  console.log(`Code AFTER:     ${codeAfter}`);

  if (codeAfter.startsWith('0xef0100')) {
    console.log('\n✅ EIP-7702 IS supported on Intuition Testnet. The browser private-key path is viable.');
  } else {
    console.log('\n❌ No delegation code installed — EIP-7702 does not appear active on this chain.');
  }
}

main().catch((e) => { console.error('\nProbe failed:', e.shortMessage || e.message); process.exit(1); });

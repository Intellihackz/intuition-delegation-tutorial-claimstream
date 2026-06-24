import { createWalletClient, createPublicClient, http, Hex, Address, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { signAuthorization } from 'viem/experimental';
import { intuitionTestnet } from './chains';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import {
  Implementation,
  toMetaMaskSmartAccount,
  ROOT_AUTHORITY,
  contracts,
  ExecutionMode
} from '@metamask/smart-accounts-kit';
import { getAddress } from 'viem';

config();

const RPC_URL = process.env.NEXT_PUBLIC_INTUITION_RPC || 'https://testnet.rpc.intuition.systems';
const DELEGATION_MANAGER = getAddress('0xdb9b1e94B5b69Df7e401DDbedE43491141047dB3'.toLowerCase());
const HYBRID_DELEGATOR = getAddress('0x48dbe696A4D990079e039489ba2053b36E8FFEC4'.toLowerCase());

const getClients = () => {
  const publicClient = createPublicClient({
    chain: intuitionTestnet,
    transport: http(RPC_URL),
  });

  const delegatorAccount = privateKeyToAccount(process.env.TEST_DELEGATOR_PRIVATE_KEY as Hex);
  const adminAccount = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as Hex);

  const delegatorClient = createWalletClient({
    account: delegatorAccount,
    chain: intuitionTestnet,
    transport: http(RPC_URL),
  });

  const adminClient = createWalletClient({
    account: adminAccount,
    chain: intuitionTestnet,
    transport: http(RPC_URL),
  });

  return { publicClient, delegatorClient, delegatorAccount, adminClient, adminAccount };
};

const storePath = path.join(process.cwd(), 'delegation-store.json');

function saveDelegation(address: string, delegation: any) {
  let store: any = {};
  if (fs.existsSync(storePath)) {
    store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  }
  store[address] = delegation;
  fs.writeFileSync(storePath, JSON.stringify(store, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

function loadDelegation(address: string) {
  if (!fs.existsSync(storePath)) throw new Error('Delegation store not found');
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const delegation = store[address];
  if (!delegation) throw new Error(`No delegation found for ${address}`);
  if (typeof delegation.salt === 'string' || typeof delegation.salt === 'number') {
    delegation.salt = BigInt(delegation.salt);
  }
  return delegation;
}

function removeDelegation(address: string) {
  if (fs.existsSync(storePath)) {
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    delete store[address];
    fs.writeFileSync(storePath, JSON.stringify(store, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
  }
}

const hybridDeleGatorAbi = [{
  name: 'initialize',
  type: 'function',
  inputs: [
    { name: 'owners', type: 'address[]' },
    { name: 'guardians', type: 'address[]' },
    { name: 'approvals', type: 'uint256[]' },
    { name: 'keys', type: 'bytes[]' },
  ],
  outputs: [],
}] as const;

export async function upgradeToSmartAccount() {
  const { delegatorClient, delegatorAccount } = getClients();

  console.log(`[1] Upgrading delegator ${delegatorAccount.address} to smart account...`);
  
  const authorization = await signAuthorization(delegatorClient, {
    account: delegatorAccount,
    contractAddress: HYBRID_DELEGATOR,
  });

  const initData = encodeFunctionData({
    abi: hybridDeleGatorAbi,
    functionName: 'initialize',
    args: [[delegatorAccount.address], [], [], []],
  });

  const txHash = await delegatorClient.sendTransaction({
    account: delegatorAccount,
    to: delegatorAccount.address,
    data: initData,
    authorizationList: [authorization],
  });

  console.log(`[1] TX Hash: https://testnet.explorer.intuition.systems/tx/${txHash}`);
  return txHash;
}

export async function createAndSignDelegation() {
  const { publicClient, delegatorAccount } = getClients();
  const adminAddress = process.env.NEXT_PUBLIC_ADMIN_ADDRESS as Address;

  console.log(`[2] Creating and signing delegation from ${delegatorAccount.address} to ${adminAddress}...`);

  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [delegatorAccount.address, [], [], []],
    deploySalt: '0x',
    signer: { account: delegatorAccount } as any,
  });

  const delegation = {
    delegate: adminAddress,
    delegator: delegatorAccount.address,
    authority: ROOT_AUTHORITY,
    caveats: [],
    salt: 0n,
    signature: '0x'
  };

  // sign typed data for the delegation
  const signature = await smartAccount.signTypedData({
    domain: {
      name: 'DelegationManager',
      version: '1',
      chainId: intuitionTestnet.id,
      verifyingContract: DELEGATION_MANAGER,
    },
    types: {
      Delegation: [
        { name: 'delegate', type: 'address' },
        { name: 'delegator', type: 'address' },
        { name: 'authority', type: 'bytes32' },
        { name: 'caveats', type: 'Caveat[]' },
        { name: 'salt', type: 'uint256' },
      ],
      Caveat: [
        { name: 'enforcer', type: 'address' },
        { name: 'terms', type: 'bytes' },
      ],
    },
    primaryType: 'Delegation',
    message: delegation,
  });

  const signedDelegation = {
    ...delegation,
    signature,
  };

  saveDelegation(delegatorAccount.address, signedDelegation);
  console.log(`[2] Delegation signed and saved for ${delegatorAccount.address}`);
  return signedDelegation;
}

export async function redeemDelegation(delegatorAddress: string, calldata: Hex) {
  const { adminClient, adminAccount } = getClients();
  const delegation = loadDelegation(delegatorAddress);

  console.log(`[3] Redeeming delegation for ${delegatorAddress} by admin ${adminAccount.address}...`);

  const redeemCalldata = contracts.DelegationManager.encode.redeemDelegations({
    delegations: [
      [
        {
          ...delegation,
          signature: delegation.signature,
        }
      ]
    ],
    modes: [ExecutionMode.SingleDefault],
    executions: [[{
      target: delegatorAddress as `0x${string}`,
      value: 0n,
      callData: calldata
    }]],
  });

  const txHash = await adminClient.sendTransaction({
    account: adminAccount,
    to: DELEGATION_MANAGER,
    data: redeemCalldata,
  });

  console.log(`[3] TX Hash: https://testnet.explorer.intuition.systems/tx/${txHash}`);
  return txHash;
}

export async function revokeDelegation(delegatorAddress: string) {
  const { delegatorClient, delegatorAccount } = getClients();
  const delegation = loadDelegation(delegatorAddress);

  console.log(`[4] Revoking delegation for ${delegatorAddress}...`);

  const disableCalldata = contracts.DelegationManager.encode.disableDelegation(delegation);

  const txHash = await delegatorClient.sendTransaction({
    account: delegatorAccount,
    to: DELEGATION_MANAGER,
    data: disableCalldata,
  });

  removeDelegation(delegatorAddress);
  console.log(`[4] TX Hash: https://testnet.explorer.intuition.systems/tx/${txHash}`);
  return txHash;
}

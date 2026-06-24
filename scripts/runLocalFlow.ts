import {
  upgradeToSmartAccount,
  createAndSignDelegation,
  redeemDelegation,
  revokeDelegation
} from '../src/lib/testLocalFlow';
import { config } from 'dotenv';

config();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  try {
    const delegatorAddress = process.env.TEST_DELEGATOR_PRIVATE_KEY 
      ? require('viem/accounts').privateKeyToAccount(process.env.TEST_DELEGATOR_PRIVATE_KEY as `0x${string}`).address 
      : null;

    if (!delegatorAddress) {
      throw new Error('TEST_DELEGATOR_PRIVATE_KEY is required in env vars');
    }

    console.log('=== STEP 1: UPGRADE ===');
    await upgradeToSmartAccount();
    await delay(3000);

    console.log('\n=== STEP 2: CREATE AND SIGN ===');
    await createAndSignDelegation();
    await delay(3000);

    console.log('\n=== STEP 3: REDEEM ===');
    // Using an empty '0x' calldata for now, will be updated to real Intuition call later
    await redeemDelegation(delegatorAddress, '0x');
    await delay(3000);

    console.log('\n=== STEP 4: REVOKE ===');
    await revokeDelegation(delegatorAddress);
    
    console.log('\n✅ Local Delegation Flow completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Flow failed with error:', err);
    process.exit(1);
  }
}

main();

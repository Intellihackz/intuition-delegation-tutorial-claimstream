# Getting Started with Delegated Execution on Intuition

In standard Web3 applications, every single on-chain action requires the user to manually confirm a MetaMask popup and pay gas fees. For high-frequency social protocols like Intuition, where users constantly interact with knowledge graphs by creating claims, supporting statements, or opposing triples, this constant friction causes severe user drop-off. Delegated execution solves this UX bottleneck by allowing users to delegate specific, restricted permissions to an automated agent or backend relayer.

To understand how this architecture operates, it is helpful to explore the core protocol building blocks that make seamless delegated execution possible.

## Core Concepts

* **Externally Owned Account (EOA)**: The foundational layer of user identity. This is the standard wallet address managed directly by browser extensions like MetaMask. In traditional web3 applications, an EOA must sign every individual transaction directly on-chain, limiting automation and forcing users to approve every gas fee manually.

* **ERC-7702 (Hybrid Smart Accounts / HSA)**: A protocol upgrade introducing code execution capabilities directly to the user's existing EOA. An HSA upgrades the user's EOA into a smart account deterministically, giving it programmable account capabilities without forcing the user to transfer funds to a new address or deploy an entirely separate smart contract wallet. Because the HSA address matches the user's EOA address, all assets and identities remain unified.

* **ERC-7710 (Delegation Framework)**: A standardized protocol for creating, signing, and redeeming execution authority off-chain. Instead of giving a third party full access to a wallet, ERC-7710 allows the user to sign an off-chain EIP-712 payload that grants another address, known as the delegatee, permission to execute specific actions on their behalf.

* **Caveat Enforcers**: Smart contracts that enforce strict cryptographic constraints on the delegated payload. In the context of Intuition, caveats ensure that the delegatee can only call the MultiVault contract, can only execute the deposit function, can only spend up to a pre-defined TRUST budget, and can only execute a limited number of calls before the session key expires.

* **Backend Relayer**: A secure application server holding an Admin Wallet private key. When a user clicks Support or Oppose on the claim feed, the frontend forwards the signed delegation payload to the relayer. The relayer then broadcasts the transaction to the blockchain, paying the gas fees so the user experiences zero transaction popups.

* **DelegationManager Contract**: The central verification engine on Intuition. It receives the delegation payload from the relayer, verifies the user's signature, passes the transaction parameters through every attached Caveat Enforcer, and only forwards the call to the destination contract if every rule condition passes.

* **Intuition MultiVault Contract**: The core smart contract protocol that manages Atoms, Triples, and bonding curve vaults on Intuition. When the DelegationManager validates a delegated execution, it calls deposit on the MultiVault, crediting the resulting vault shares directly to the user's address.

## The Delegation Flow

The complete information and authority flow connects the user's browser, the backend relayer, and the Intuition smart contract infrastructure in a single unified execution path. 

First, the user deploys and funds their Hybrid Smart Account and signs an off-chain EIP-712 delegation payload. When the user interacts with the claim feed, the frontend sends this payload to the backend relayer API instead of opening a wallet modal. The relayer submits the execution to the DelegationManager contract, which verifies all attached Caveat Enforcers before executing the deposit on the MultiVault contract.

![Delegation Flow Diagram](./assets/delegation-flow.png)

## Exploring the Implementation

You can experiment with this architecture directly by running the included demo application locally.

Clone the repository, install the dependencies, and configure an `.env.local` file containing your Admin wallet private key:

```bash
git clone https://github.com/Intellihackz/intuition-delegation-tutorial-claimstream.git
cd intuition-delegation-tutorial-claimstream
npm install
npm run dev
```

Once the development server is running at `http://localhost:3000`, connect your MetaMask wallet, configure a budget, and test the smooth 1-Click staking interaction on the claim feed.

When you are ready to explore the complete codebase step by step, proceed to the [Full Code Tutorial (TUTORIAL.md)](./TUTORIAL.md) for a detailed walkthrough of the implementation.

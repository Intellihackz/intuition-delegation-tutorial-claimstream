# Intuition Claim Feed (EIP-7710 Delegation Tutorial)

A decentralized, monochromatic activity feed built on the **Intuition Protocol**. This application demonstrates how to create, view, and stake on truth claims (triples) while integrating the **MetaMask Delegation Framework (ERC-7710 / ERC-7702)**.

This repository serves as the demo application and source code for **Mission 09: Delegation Framework Tutorial for Intuition (ERC-7710)**.

## 🎯 Mission Objective
The core objective of this application is to serve as an educational resource that teaches builders the full information flow of the MetaMask Delegation Framework in the context of Intuition. 

Through this tutorial application, builders will learn how to:
1. **Upgrade to ERC-7702**: Upgrade a standard EOA to a smart account on the Intuition chain to enable delegation.
2. **Sign Delegations**: Create and sign a delegation object with specific constraints (caveats).
3. **Redeem Delegations**: Allow a delegatee to exercise delegated authority to perform Intuition operations (e.g., atom/triple creation, vault deposits).
4. **Revoke Delegations**: Cancel an active delegation securely.
5. **Caveat Enforcers**: Understand how to link and deploy custom enforcers to restrict what delegates can do on Intuition.

## 🚀 Features (Phase 1 & 2)

### Phase 1: Core Intuition Protocol (Implemented)
- **Monochrome UI**: A sleek, premium, ledger-like interface.
- **Claim Creation**: Publish new triples (Subject-Predicate-Object) to the Intuition Network.
- **Truth Staking**: Support or Oppose claims using `tTRUST` deposits directly into the Intuition bonding curves.
- **Infinite Scrolling Feed**: A Twitter-style activity feed powered by the `@0xintuition/graphql` SDK.

### Phase 2: EIP-7710 Delegation (Coming Soon)
- Integration with `@metamask/smart-accounts-kit`.
- Delegated execution of Claim Creation and Staking.
- Granular permissions using Caveat Enforcers.

## 🛠️ Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS (Monochrome aesthetic)
- **Web3**: `viem`, MetaMask
- **Protocol**: `@0xintuition/protocol`, `@0xintuition/sdk`, `@0xintuition/graphql`
- **Delegation**: `@metamask/smart-accounts-kit` (Phase 2)

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- MetaMask wallet with Intuition Testnet configured.
- Testnet `tTRUST` tokens.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Intellihackz/intuition-delegation-tutorial-claimstream.git
   cd intuition-delegation-tutorial-claimstream
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📜 Network Details
- **Network**: Intuition Testnet (L3)
- **Chain ID**: 13579
- **RPC URL**: `https://testnet.rpc.intuition.systems`
- **GraphQL Endpoint**: `https://testnet.intuition.sh/v1/graphql`

---
*Built for the Intuition Ecosystem.*

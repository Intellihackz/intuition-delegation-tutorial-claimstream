# Intuition Claim Feed (ERC-7710 Delegation Tutorial DApp)

A full-stack Next.js application built on the **Intuition Protocol** demonstrating **Delegated Execution (ERC-7710)** and **Hybrid Smart Accounts (ERC-7702)**. 

This repository serves as the official open-source demo application and educational resource for **Mission 09: Delegation Framework Tutorial for Intuition (ERC-7710)**.

---

## 📚 Documentation & Guides

| Guide | Description |
| :--- | :--- |
| 🚀 **[GET_STARTED.md](./GET_STARTED.md)** | **High-Level Overview & Diagrams**: What ERC-7710/7702 are, System Architecture, User Lifecycle Flow, and Data/Authority Flow diagrams. |
| 📖 **[TUTORIAL.md](./TUTORIAL.md)** | **Step-by-Step Developer Code Tutorial**: Full code walkthrough building this DApp from scratch. |

---

## 🎯 Educational Objectives

Through this project, developers learn how to:
1. **Upgrade to ERC-7702**: Upgrade a standard EOA to a Hybrid Smart Account (HSA) on Intuition Mainnet without changing wallet addresses.
2. **Attach Caveat Enforcers**: Scope delegation permissions using `AllowedTargets`, `AllowedMethods` (4-byte selector), and `NativeTokenTransferAmount`.
3. **Execute Delegated Actions (ERC-7710)**: Use a backend Relayer API (`/api/stake`) to redeem delegations on the `DelegationManager` and execute MultiVault deposits gaslessly for the user.
4. **Visualize HSA Budget**: Display a live progress bar tracking remaining native TRUST budget on the HSA.
5. **Revoke Delegations**: Safely disable delegations on-chain.

---

## 🚀 App Features

- **Intuition Claim Feed**: Paginated, infinite scroll feed of claims (triples) powered by `@0xintuition/graphql`.
- **Claim Creation**: Form to publish Subjects, Predicates, and Objects (Atoms) and link them into Triples using `@0xintuition/sdk`.
- **1-Click Staking**: Support or Oppose claims instantly without transaction popups via backend delegated execution.
- **HSA Budget Dashboard**: Live balance indicator for the user's Hybrid Smart Account.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 / 16 (App Router)
- **Web3 Libraries**: `viem`, `@metamask/smart-accounts-kit`, `@0xintuition/protocol`, `@0xintuition/sdk`, `@0xintuition/graphql`
- **Network**: Intuition Mainnet (Chain ID: `1155`)

---

## 📦 Running Locally

### 1. Clone & Install
```bash
git clone https://github.com/Intellihackz/intuition-delegation-tutorial-claimstream.git
cd intuition-delegation-tutorial-claimstream
npm install
```

### 2. Configure Environment Variables
Create `.env.local`:
```env
# Admin wallet private key (used to pay gas for 1-click staking relay)
ADMIN_PRIVATE_KEY=0xYourPrivateKeyHere
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

*Built for the Intuition Ecosystem.*

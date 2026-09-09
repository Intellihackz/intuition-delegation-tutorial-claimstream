# Intuition Claim Feed (ERC-7710 Delegation Tutorial DApp)

A full-stack Next.js application built on the **Intuition Protocol** demonstrating **Delegated Execution (ERC-7710)** and **Hybrid Smart Accounts (ERC-7702)**. 

This repository serves as the official open-source demo application and educational resource for **Mission 09: Delegation Framework Tutorial for Intuition (ERC-7710)**.

---

## Master Tutorial Guide

👉 **[Read the Full Tutorial (TUTORIAL.md)](./TUTORIAL.md)**: Includes high-level concepts, system architecture, delegation flow diagrams, and a step-by-step developer code walkthrough for building this DApp from scratch.

---

## Educational Objectives

Through this project, developers learn how to:
1. **Upgrade to ERC-7702**: Upgrade a standard EOA to a Hybrid Smart Account (HSA) on Intuition Mainnet without changing wallet addresses.
2. **Attach Caveat Enforcers**: Scope delegation permissions using `AllowedTargets`, `AllowedMethods` (`deposit` + `redeem` selectors), `NativeTokenPeriodTransfer` (an auto-refilling daily cap), `LimitedCalls`, and a `Timestamp` expiry, plus a pinned `receiver` via `allowedCalldata`.
3. **Execute Delegated Actions (ERC-7710)**: Use a backend Relayer API (`/api/stake`) to redeem delegations on the `DelegationManager` and run gasless MultiVault deposits **and withdrawals** for the user.
4. **Grant scoped MultiVault access**: `approve(HSA, BOTH)` so the relayer can deposit and redeem with the shares/TRUST always credited to the user.
5. **Visualize the daily allowance**: Live meter of how much of today's delegated spend cap is left, plus the HSA balance and explorer link.
6. **Revoke Delegations**: Safely disable delegations on-chain and sweep any unspent HSA balance back.

---

## App Features

- **Intuition Claim Feed**: Paginated, infinite scroll feed of claims (triples) from a small custom GraphQL query.
- **Toggle staking**: Support / Oppose to open a position, click the same side to withdraw, click the other side to switch — all gasless, no wallet popups.
- **Delegated Activity Log**: Bottom-docked, expandable panel recording every delegated `deposit` / `redeem` with its raw call and a transaction link.
- **Delegated Staking Wizard**: Four one-at-a-time steps (deploy HSA, fund, approve MultiVault, sign delegation) with a live daily-allowance meter once active.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Web3 Libraries**: `viem`, `@metamask/smart-accounts-kit`, `@tanstack/react-query`
- **Network**: Intuition Mainnet (Chain ID: `1155`)

---

## Running Locally

### 1. Clone & Install
```bash
git clone https://github.com/Intellihackz/intuition-delegation-tutorial-claimstream.git
cd intuition-delegation-tutorial-claimstream
npm install
```

### 2. Configure Environment Variables
Create `.env.local`:
```env
# Admin wallet private key (used to pay gas for delegated staking relay)
ADMIN_PRIVATE_KEY=0xYourPrivateKeyHere

# Public address derived from ADMIN_PRIVATE_KEY above — must match, or
# delegations will be signed for a relayer that can't redeem them
NEXT_PUBLIC_ADMIN_ADDRESS=0xYourPublicAddressHere
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

*Built for the Intuition Ecosystem.*

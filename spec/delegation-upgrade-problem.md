# Spec: In-Browser Smart-Account Upgrade & Delegation on Intuition

**Status:** diagnosed — architecture decision pending (relay route)
**Date:** 2026-06-25
**App:** Intuition Claim Feed — Mission 09 (EIP-7710 Delegation Framework tutorial)
**Chain:** Intuition Testnet (chain id `13579` / `0x350b`), an **Arbitrum Orbit L3** (`nitro/v3.9.9`)

> Scope: this spec is only about the smart-account **upgrade / delegation** flow.
> Unrelated claim-feed fixes (wallet chain switching, triple creation cost) are
> out of scope here.

---

## 1. Goal

Let a user connect MetaMask, turn their account into a smart account, and use the
MetaMask Delegation Framework (ERC-7710 / ERC-7702) to create, sign, redeem, and
revoke delegations for Intuition operations (atom/triple creation, vault deposits).

## 2. Problem (in the order it surfaced)

### 2.1 EIP-7702 upgrade via `signAuthorization` — `AccountTypeNotSupportedError`
- **Symptom:** `The signAuthorization Action does not support JSON-RPC Accounts`.
- **Cause:** `useSmartAccountUpgrade.ts` copied the local-script pattern, but
  viem's `signAuthorization` only works with **local-key accounts** (it requires
  `account.signAuthorization`). A MetaMask connection is a `json-rpc` account with
  no local key. MetaMask does not expose raw 7702 authorization signing to dApps.
  → This approach **fundamentally cannot work in the browser.**

### 2.2 EIP-5792 `wallet_sendCalls` attempt
- Rewrote the hook to delegate the upgrade to MetaMask via `sendCalls`.
- Bug 1: `data: "0x"` rejected — MetaMask requires `/^0x[0-9a-f]+$/`. Fixed by
  omitting `data` (value-only no-op self-call).
- Bug 2: a **single** call doesn't require smart-account capability, so MetaMask
  just sent a plain self-transfer (tx `0x687c…20ba`: type 2, 21k gas, empty
  input, account code still `0x` → **no upgrade**). Fixed by `forceAtomic: true`
  with **two** no-op calls (atomic multi-call is impossible for an EOA, forcing
  the upgrade).
- Bug 3 (**hard blocker**): MetaMask then returned
  `EIP-7702 not supported on chain: 0x350b`.

### 2.3 Root constraint — MetaMask will not do EIP-7702 on Intuition
- **Two different allowlists, which disagree:**
  1. **Delegation Toolkit deployment registry** (`getSmartAccountsEnvironment(13579)`
     from `@metamask/smart-accounts-kit`) — **includes** Intuition; the framework
     contracts are deployed (see §3).
  2. **MetaMask extension's own EIP-7702 chain allowlist** — **excludes** 13579.
     Maintained centrally by MetaMask (remote feature flags + constants in
     `@metamask/transaction-controller`, enforced in `metamask-extension`).
     There is **no dApp- or user-side way** to add a chain to it.
- **Conclusion:** the contracts exist on Intuition, but MetaMask's wallet UI
  refuses to trigger an in-place 7702 upgrade there. → In-browser MetaMask 7702
  upgrade is **not achievable on Intuition today**; it is an ecosystem limitation,
  not an app bug.

## 3. Chain facts (verified on-chain, testnet)

| Contract | Address | Status |
|---|---|---|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ✅ deployed (newly added) |
| SimpleFactory | `0x69Aa2f9fe1572F1B640E1bbc512f5c3a734fc77c` | ✅ deployed |
| HybridDeleGatorImpl | `0x48dbe696A4D990079e039489ba2053b36E8FFEC4` | ✅ deployed |
| DelegationManager | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` | ✅ deployed |

- RPC supports `debug_traceCall` / `debug_traceTransaction` → a standard bundler
  can run in **full validation mode** (no `--unsafe`).
- `eth_supportedEntryPoints` is **not** served by the RPC → **no bundler runs
  there yet**.

## 4. Path forward — pivot from EIP-7702 to ERC-4337 Hybrid smart account

Now that the EntryPoint v0.7 is live, take the path MetaMask cannot block:

- **Model:** a **counterfactual Hybrid DeleGator smart-account contract** owned by
  the MetaMask EOA. MetaMask only **signs** userOps/delegations (plain message
  signing — works on any chain). No in-place 7702 upgrade → MetaMask's chain
  allowlist never applies. This is already the model `testLocalFlow.ts` uses for
  `createAndSignDelegation` (`Implementation.Hybrid`).
- **Build:** `toMetaMaskSmartAccount({ implementation: Hybrid, signatory: { walletClient } })`,
  deploy counterfactually via SimpleFactory on first userOp.
- **Consequence:** the user's on-chain identity becomes the **smart-account
  address**, not the EOA — claims/stakes (`caip10:eip155:13579:<address>`) must
  reference the smart account.

### Open decision — how to relay UserOperations to the EntryPoint
1. **Self-bundle** (no external service): build + EOA-sign the userOp, then a
   relayer EOA (`ADMIN_PRIVATE_KEY`, already in env) calls
   `EntryPoint.handleOps([userOp], beneficiary)` directly. Works today with what's
   deployed; best for the tutorial/demo; admin pays gas.
2. **Bundler service** (e.g. **Rundler** — best Arbitrum/Orbit gas handling):
   `toMetaMaskSmartAccount` + a bundler client (`eth_sendUserOperation`).
   Production-shaped; tracing is available so it can run in full mode. Main gotcha
   is Arbitrum L3 `preVerificationGas` estimation (Rundler handles it). ~1–3h to
   stand up.

Either route uses identical in-app Hybrid smart-account code; only the final hop
to the EntryPoint differs, so the choice is **not** locked in.

## 5. Relevant files
- `src/hooks/useSmartAccountUpgrade.ts` — EIP-5792 attempt (now known blocked on
  this chain; to be replaced by the ERC-4337 Hybrid flow).
- `src/lib/testLocalFlow.ts` — reference local-key flow already using
  `Implementation.Hybrid` for sign/redeem/revoke.
- `scripts/probe7702.ts` — standalone probe: does the chain install 7702 code via a
  local-key authorization? (run with a funded `PROBE_PRIVATE_KEY`).

## 6. Next steps
1. Pick the relay route (§4).
2. Replace the 7702 "upgrade" UX with the Hybrid smart-account flow (derive +
   counterfactually deploy; reference the smart-account address everywhere).
3. Implement create/sign/redeem/revoke delegation in-browser against the Hybrid
   account + EntryPoint.
4. (If route 2) stand up Rundler for Intuition and wire its URL.

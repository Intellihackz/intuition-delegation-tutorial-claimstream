// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @dev Matches @metamask/delegation-abis's ICaveatEnforcer -- the interface
/// the DelegationManager calls into around every redeemed execution.
interface ICaveatEnforcer {
    function beforeHook(
        bytes calldata _terms,
        bytes calldata _args,
        bytes32 _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;

    function afterHook(
        bytes calldata _terms,
        bytes calldata _args,
        bytes32 _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;

    function beforeAllHook(
        bytes calldata _terms,
        bytes calldata _args,
        bytes32 _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;

    function afterAllHook(
        bytes calldata _terms,
        bytes calldata _args,
        bytes32 _mode,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address _delegator,
        address _redeemer
    ) external;
}

/**
 * @title MultiVaultPerClaimCapEnforcer
 * @notice A custom ERC-7710 Caveat Enforcer for the Intuition MultiVault.
 *
 * The stock `NativeTokenTransferAmountEnforcer` (used elsewhere in this
 * tutorial) caps the AGGREGATE amount a delegation can spend across every
 * redemption. It cannot express a per-destination limit, so a delegate
 * holding, say, a 5 TRUST budget could legally deposit the entire 5 TRUST
 * into a single claim in one call. This enforcer adds that missing
 * dimension: it caps how much TRUST a single delegation may deposit into any
 * ONE claim (identified by its MultiVault `termId`), independent of how many
 * different claims it touches overall -- e.g. "spend up to 5 TRUST total,
 * but never more than 1 TRUST on any single claim."
 *
 * Pair this with `AllowedTargets` (MultiVault only) and `AllowedMethods`
 * (deposit only) caveats, exactly as the other caveats in this tutorial's
 * `useAdminDelegation.ts` are combined -- this enforcer does not re-check
 * the call target or selector itself.
 *
 * Scope note: this enforcer assumes the redeemed execution is a SINGLE
 * default-mode call (`ExecutionMode.SingleDefault`) targeting
 * `MultiVault.deposit(address,bytes32,uint256,uint256)` -- exactly how this
 * repo's relayer (`src/app/api/stake/route.ts`) redeems delegations. It is
 * not a general-purpose decoder for arbitrary batched executions.
 */
contract MultiVaultPerClaimCapEnforcer is ICaveatEnforcer {
    // deposit(address receiver, bytes32 termId, uint256 curveId, uint256 minShares)
    // Offset into the deposit() calldata (after the 4-byte selector) where
    // the `termId` argument lives. Mirrors DEPOSIT_OFFSET.termId in
    // src/lib/constants.ts, which this contract's caveat is meant to pair with.
    uint256 private constant TERM_ID_OFFSET = 36; // 4-byte selector + 32-byte receiver slot

    /// spent[delegationHash][termId] => cumulative wei deposited into that claim
    mapping(bytes32 => mapping(bytes32 => uint256)) public spent;

    event PerClaimSpendIncreased(bytes32 indexed delegationHash, bytes32 indexed termId, uint256 amount, uint256 totalForClaim);

    error PerClaimCapExceeded(bytes32 termId, uint256 attempted, uint256 cap);
    error InvalidExecutionLength();

    /// @notice terms = abi.encode(uint256 maxPerClaim) -- the max wei a
    /// single termId may receive across every redemption of this delegation.
    function getTermsInfo(bytes calldata _terms) public pure returns (uint256 maxPerClaim) {
        maxPerClaim = abi.decode(_terms, (uint256));
    }

    function beforeHook(
        bytes calldata _terms,
        bytes calldata /* _args */,
        bytes32 /* _mode */,
        bytes calldata _executionCalldata,
        bytes32 _delegationHash,
        address /* _delegator */,
        address /* _redeemer */
    ) external override {
        uint256 maxPerClaim = getTermsInfo(_terms);

        // ERC-7579 single-execution encoding: 20-byte target ++ 32-byte value ++ callData
        if (_executionCalldata.length < 52 + TERM_ID_OFFSET + 32) revert InvalidExecutionLength();
        uint256 value = uint256(bytes32(_executionCalldata[20:52]));
        bytes calldata callData = _executionCalldata[52:];

        bytes32 termId = bytes32(callData[TERM_ID_OFFSET:TERM_ID_OFFSET + 32]);

        uint256 newTotal = spent[_delegationHash][termId] + value;
        if (newTotal > maxPerClaim) revert PerClaimCapExceeded(termId, newTotal, maxPerClaim);

        spent[_delegationHash][termId] = newTotal;
        emit PerClaimSpendIncreased(_delegationHash, termId, value, newTotal);
    }

    // This enforcer only needs to run before the call lands. The other three
    // hooks are required by the interface but are intentionally no-ops.
    function afterHook(bytes calldata, bytes calldata, bytes32, bytes calldata, bytes32, address, address) external override {}
    function beforeAllHook(bytes calldata, bytes calldata, bytes32, bytes calldata, bytes32, address, address) external override {}
    function afterAllHook(bytes calldata, bytes calldata, bytes32, bytes calldata, bytes32, address, address) external override {}
}

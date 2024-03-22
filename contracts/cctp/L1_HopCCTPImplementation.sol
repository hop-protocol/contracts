// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./HopCCTPImplementation.sol";

contract L1_HopCCTPImplementation is HopCCTPImplementation {
    constructor(
        address nativeTokenAddress,
        address cctpAddress,
        address feeCollectorAddress,
        uint256 minBonderFee,
        uint256[] memory chainIds,
        uint32[] memory domains
    ) HopCCTPImplementation(
        nativeTokenAddress,
        cctpAddress,
        feeCollectorAddress,
        minBonderFee,
        chainIds,
        domains
    ) {}
}
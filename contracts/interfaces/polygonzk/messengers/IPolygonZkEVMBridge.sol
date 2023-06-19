// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.6.12;

interface IPolygonZkEVMBridge {
    function bridgeMessage(
        uint32 destinationNetwork,
        address destinationAddress,
        bool forceUpdateGlobalExitRoot,
        bytes calldata metadata
    ) external payable;
}
// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

contract Mock_L1_PolygonzkMessenger {
    function bridgeMessage(
        uint32 destinationNetwork,
        address destinationAddress,
        bool forceUpdateGlobalExitRoot,
        bytes calldata metadata
    ) external {}
}

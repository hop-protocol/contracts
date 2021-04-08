// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_PolygonMessengerProxy.sol";
import "../bridges/L2_PolygonBridge.sol";

contract Mock_L2_PolygonBridge is L2_PolygonBridge {
    uint256 private chainId;

    constructor (
        uint256 _chainId,
        L2_PolygonMessengerProxy messenger,
        address l1Governance,
        HopBridgeToken hToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address[] memory bonders
    )
        public
        L2_PolygonBridge(
            messenger,
            l1Governance,
            hToken,
            l1BridgeAddress,
            supportedChainIds,
            bonders
        )
    {
        chainId = _chainId;
    }

    function getChainId() public override view returns (uint256) {
        return chainId;
    }
}

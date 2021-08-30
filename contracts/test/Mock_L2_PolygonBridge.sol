// SPDX-License-Identifier: UNLICENSED
// @unsupported: ovm

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/polygon/messengers/I_L2_PolygonMessengerProxy.sol";
import "../bridges/L2_PolygonBridge.sol";

contract Mock_L2_PolygonBridge is L2_PolygonBridge {
    uint256 private chainId;

    constructor (
        uint256 _chainId,
        I_L2_PolygonMessengerProxy messenger,
        address l1Governance,
        HopBridgeToken hToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        IBonderRegistry registry
    )
        public
        L2_PolygonBridge(
            messenger,
            l1Governance,
            hToken,
            l1BridgeAddress,
            supportedChainIds,
            registry
        )
    {
        chainId = _chainId;
    }

    function getChainId() public override view returns (uint256) {
        return chainId;
    }
}

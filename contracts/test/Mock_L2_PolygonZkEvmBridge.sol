// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_PolygonZkEvmBridge.sol";
import "../interfaces/polygonzkevm/messengers/I_L2_PolygonZkEvmMessengerProxy.sol";

contract Mock_L2_PolygonZkEvmBridge is L2_PolygonZkEvmBridge  {
    constructor (
        I_L2_PolygonZkEvmMessengerProxy messenger,
        address l1Governance,
        HopBridgeToken hToken,
        address l1BridgeAddress,
        uint256[] memory activeChainIds,
        address[] memory bonders
    )
        public
        L2_PolygonZkEvmBridge(
            messenger,
            l1Governance,
            hToken,
            l1BridgeAddress,
            activeChainIds,
            bonders
        )
    {}
}

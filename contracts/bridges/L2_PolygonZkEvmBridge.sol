// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/polygonzkevm/messengers/I_L2_PolygonZkEvmMessengerProxy.sol";
import "./L2_Bridge.sol";

/**
 * @dev A MessengerWrapper for the Polygon zkEVM - https://polygon.technology/polygon-zkevm
 */

contract L2_PolygonZkEvmBridge is L2_Bridge {
    I_L2_PolygonZkEvmMessengerProxy public messengerProxy;

    constructor (
        I_L2_PolygonZkEvmMessengerProxy _messengerProxy,
        address l1Governance,
        HopBridgeToken hToken,
        address l1BridgeAddress,
        uint256[] memory activeChainIds,
        address[] memory bonders
    )
        public
        L2_Bridge(
            l1Governance,
            hToken,
            l1BridgeAddress,
            activeChainIds,
            bonders
        )
    {
        messengerProxy = _messengerProxy;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        messengerProxy.sendCrossDomainMessage(message);
    }

    function _verifySender(address expectedSender) internal override {
        require(msg.sender == address(messengerProxy), "L2_PLGNZK_BRG: Caller is not the expected sender");
        // Verify that cross-domain sender is expectedSender
        require(messengerProxy.xDomainMessageSender() == expectedSender, "L2_PLGNZK_BRG: Invalid cross-domain sender");
    }

    /**
     * @dev Allows the L1 Bridge to set the messengerProxy proxy
     * @param _messengerProxy The new messengerProxy address
     */
    function setMessengerProxy(I_L2_PolygonZkEvmMessengerProxy _messengerProxy) external onlyGovernance {
        messengerProxy = _messengerProxy;
    }
}

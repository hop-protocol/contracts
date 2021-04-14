// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./L2_Bridge.sol";
import "./L2_PolygonMessengerProxy.sol";

/**
 * @dev An L2_Bridge for Polygon - https://docs.matic.network/docs
 */

contract L2_PolygonBridge is L2_Bridge {
    L2_PolygonMessengerProxy public messengerProxy;

    event L1_BridgeMessage(bytes data);

    constructor (
        L2_PolygonMessengerProxy _messengerProxy,
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
        require(msg.sender == address(messengerProxy), "L2_PLGN_BRG: Caller is not the expected sender");
        // Verify that cross-domain sender is expectedSender
        require(messengerProxy.xDomainMessageSender() == expectedSender, "L2_PLGN_BRG: Invalid cross-domain sender");
    }

    /**
     * @dev Allows the L1 Bridge to set the messengerProxy proxy
     * @param _messengerProxy The new messengerProxy address
     */
    function setMessengerProxy(L2_PolygonMessengerProxy _messengerProxy) external onlyGovernance {
        messengerProxy = _messengerProxy;
    }
}

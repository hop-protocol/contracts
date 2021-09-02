// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/polygon/messengers/I_L2_PolygonMessengerProxy.sol";
import "./L2_Connector.sol";

contract L2_PolygonConnector is L2_Connector {
    I_L2_PolygonMessengerProxy public messengerProxy;

    constructor (
        address _l1Address,
        address _l2Address,
        I_L2_PolygonMessengerProxy _messengerProxy
    )
        public
        L2_Connector(
            _l1Address,
            _l2Address
        )
    {
        messengerProxy = _messengerProxy;
    }

    /* ========== Override Functions ========== */

    function _forwardCrossDomainMessage() internal override {
        messengerProxy.sendCrossDomainMessage(msg.data);
    }

    function _verifySender() internal override {
        require(msg.sender == address(messengerProxy), "L2_PLGN_CNR: Caller is not the expected sender");
        // Verify that cross-domain sender is expectedSender
        require(messengerProxy.xDomainMessageSender() == l1Address, "L2_PLGN_CNR: Invalid cross-domain sender");
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./Connector.sol";

contract L1_ArbitrumConnector is Connector {
    constructor (
        address _owner
    )
        public
        Connector(_owner)
    {}

    /* ========== Override Functions ========== */

    function _forwardCrossDomainMessage() internal override {
        // ToDo not implemented
        // ToDo pass msg.value to Inbox to pay for L2 fee
    }

    function _verifySender() internal override {
        // ToDo not implemented
    }
}

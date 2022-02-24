// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./Connector.sol";

contract L2_ArbitrumConnector is Connector {
    constructor (
        address _localAddress
    )
        public
        Connector(_localAddress)
    {}

    /* ========== Override Functions ========== */

    function _forwardCrossDomainMessage() internal override {
        // ToDo not implemented
    }

    function _verifySender() internal override {
        // ToDo not implemented
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./L2_Connector.sol";

contract L2_ArbitrumConnector is L2_Connector {
    constructor (
        address _l1Address,
        address _l2Address
    )
        public
        L2_Connector(
            _l1Address,
            _l2Address
        )
    {}

    /* ========== Override Functions ========== */

    function _forwardCrossDomainMessage() internal override {
        // ToDo not implemented
    }

    function _verifySender() internal override {
        // ToDo not implemented
    }
}

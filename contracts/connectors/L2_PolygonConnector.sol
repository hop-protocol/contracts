// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "../polygon/tunnel/FxBaseChildTunnel.sol";

contract L2_PolygonConnector is FxBaseChildTunnel {
    address public l2Address;

    constructor (
        address _l2Address,
        address _fxChild
    )
        public
        FxBaseChildTunnel(_fxChild)
    {
        l2Address = _l2Address;
    }

    fallback () external {
        require(msg.sender == l2Address, "L2_PLGN_CNR: Only l2Address can forward messages");
        _sendMessageToRoot(msg.data);
    }

    /* ========== Override Functions ========== */

    function _processMessageFromRoot(
        uint256 /* stateId */,
        address sender,
        bytes memory data
    )
        internal
        override
        validateSender(sender)
    {
        (bool success,) = l2Address.call(data);
        require(success, "L2_PGLN_CNR: Failed to proxy message");
    }
}

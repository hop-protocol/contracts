// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "../polygon/tunnel/FxBaseChildTunnel.sol";

contract L2_PolygonConnector is FxBaseChildTunnel {
    address public localAddress;

    constructor (
        address _localAddress,
        address _fxChild
    )
        public
        FxBaseChildTunnel(_fxChild)
    {
        localAddress = _localAddress;
    }

    fallback () external {
        require(msg.sender == localAddress, "L2_PLGN_CNR: Only localAddress can forward messages");
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
        (bool success,) = localAddress.call(data);
        require(success, "L2_PLGN_CNR: Failed to proxy message");
    }
}

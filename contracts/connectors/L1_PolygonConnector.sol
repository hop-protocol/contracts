// SPDX-License-Identifier: MIT

pragma solidity 0.7.3;

import "../polygon/tunnel/FxBaseRootTunnel.sol";

contract L1_PolygonConnector is FxBaseRootTunnel {
    address public localAddress;

    constructor (
        address _localAddress,
        address _checkpointManager,
        address _fxRoot,
        address _fxChildTunnel
    )
        public
        FxBaseRootTunnel(_checkpointManager, _fxRoot)
    {
        localAddress = _localAddress;
        setFxChildTunnel(_fxChildTunnel);
    }

    fallback () external {
        require(msg.sender == localAddress, "L1_PLGN_CNR: Only localAddress can forward messages");
        _sendMessageToChild(msg.data);
    }

    /* ========== Override Functions ========== */

    function _processMessageFromChild(bytes memory message) internal override {
        (bool success,) = localAddress.call(message);
        require(success, "L1_PLGN_CNR: Call to localAddress failed");
    }
}

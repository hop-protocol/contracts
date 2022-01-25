// SPDX-License-Identifier: UNLICENSED
// @unsupported: ovm

pragma solidity 0.8.9;
pragma experimental ABIEncoderV2;

import "../wrappers/PolygonMessengerWrapper.sol";

contract MockPolygonMessengerWrapper is PolygonMessengerWrapper {

    constructor (
        address _l1BridgeAddress,
        address _checkpointManager,
        address _fxRoot,
        address _fxChildTunnel
    )
        public
        PolygonMessengerWrapper(
            _l1BridgeAddress,
            _checkpointManager,
            _fxRoot,
            _fxChildTunnel
        )
    {}

    function processMessageFromChild(bytes memory message) public {
        _processMessageFromChild(message);
    }
}

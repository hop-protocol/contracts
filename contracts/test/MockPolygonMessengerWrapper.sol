// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../wrappers/PolygonMessengerWrapper.sol";

contract MockPolygonMessengerWrapper is PolygonMessengerWrapper {

    constructor (address _l1BridgeAddress) public PolygonMessengerWrapper(_l1BridgeAddress) {}

    function processMessageFromChild(bytes memory message) public {
        _processMessageFromChild(message);
    }
}

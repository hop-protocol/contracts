// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_PolygonMessengerProxy.sol";

contract Mock_L2_PolygonMessengerProxy is L2_PolygonMessengerProxy {

    constructor () public L2_PolygonMessengerProxy() {}

    function processMessageFromRoot(bytes memory message) public {
        _processMessageFromRoot(message);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;
pragma experimental ABIEncoderV2;

import "../interfaces/IMessengerWrapper.sol";

abstract contract MessengerWrapper is IMessengerWrapper {
    address public immutable l1BridgeAddress;

    constructor(address _l1BridgeAddress) internal {
        l1BridgeAddress = _l1BridgeAddress;
    }

    modifier onlyL1Bridge {
        require(msg.sender == l1BridgeAddress, "MW: Sender must be the L1 Bridge");
        _;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <0.8.0;
pragma experimental ABIEncoderV2;

import "../interfaces/IMessengerWrapper.sol";

abstract contract MessengerWrapper is IMessengerWrapper {
    address public immutable l1Address;

    constructor(address _l1Address) internal {
        l1Address = _l1Address;
    }

    modifier onlyL1Address {
        require(msg.sender == l1Address, "MW: Sender must be the L1 address");
        _;
    }
}

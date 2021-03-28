// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L1_ETH_Bridge.sol";

contract Mock_L1_ETH_Bridge is L1_ETH_Bridge {

    constructor (address[] memory _bonders, address _governance) public L1_ETH_Bridge(_bonders, _governance) {}

    function getChainId() public override view returns (uint256) {
        return 1;
    }
}

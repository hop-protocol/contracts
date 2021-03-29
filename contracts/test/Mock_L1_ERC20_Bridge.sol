// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L1_ERC20_Bridge.sol";

contract Mock_L1_ERC20_Bridge is L1_ERC20_Bridge {

    constructor (IERC20 _canonicalToken, address[] memory _bonders, address _governance) public L1_ERC20_Bridge(_canonicalToken, _bonders, _governance) {}

    function getChainId() public override view returns (uint256) {
        return 1;
    }
}

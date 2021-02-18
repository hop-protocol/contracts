// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.6.6;
pragma experimental ABIEncoderV2;

import "../UniswapV2Router02.sol";

contract XDaiUniswapRouter is UniswapV2Router02 {
    constructor(address _factory, address _WETH) public UniswapV2Router02(_factory, _WETH) {}
}

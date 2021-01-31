// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./pair/UniswapV2Pair.sol";

contract OptimismUniswapPair is UniswapV2Pair {
    constructor(address _factory) public UniswapV2Pair(_factory) {}
}

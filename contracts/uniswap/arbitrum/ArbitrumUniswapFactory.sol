// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-core/contracts/UniswapV2Factory.sol";

contract ArbitrumUniswapFactory is UniswapV2Factory {
    constructor(address _feeToSetter) public UniswapV2Factory(_feeToSetter) {}
}

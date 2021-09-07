// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

contract SwapDataConsumer {
    struct SwapData {
        uint8 tokenIndex;
        uint256 amountOutMin;
        uint256 deadline;
    }
}

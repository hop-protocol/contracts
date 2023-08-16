// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BlockHashValidator {
    function isBlockHashValid(bytes32 blockHash, uint256 blockNumber) public view returns (bool) {
        return blockHash == blockhash(blockNumber);
    }
}
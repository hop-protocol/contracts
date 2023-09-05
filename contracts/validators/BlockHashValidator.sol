// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract BlockHashValidator {

    function validateBlockHash(bytes32 blockHash, uint256 blockNumber) external view {
        require(isBlockHashValid(blockHash, blockNumber), "BHV: Invalid truncated block hash");
    }

    function isBlockHashValid(bytes32 blockHash, uint256 blockNumber) public view returns (bool) {
        // The blockhash defaults to 0 outside of the range of 256 blocks.
        if (blockHash == bytes32(0)) {
            return false;
        }
        return blockHash == getBlockHash(blockNumber);
    }

    /* Public Getters */

    function getBlockHash(uint256 blockNumber) public view returns (bytes32) {
        return blockhash(blockNumber);
    }
}
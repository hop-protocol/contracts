// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract BlockHashValidator {

    function validateBlockHash(bytes32 blockHash, uint40 blockNumber) external view {
        require(isBlockHashValid(blockHash, blockNumber), "BHV: Invalid truncated block hash");
    }

    function isBlockHashValid(bytes32 blockHash, uint40 blockNumber) public view returns (bool) {
        if (!_isBlockWithinRange(uint256(blockNumber))) {
            return false;
        }
        return blockHash == getBlockHash((uint256(blockNumber)));
    }

    /* Public Getters */

    function getBlockHash(uint256 blockNumber) public view returns (bytes32) {
        return blockhash(blockNumber);
    }

    /* Internal Functions */

    function _isBlockWithinRange(uint256 blockNumber) internal view returns (bool) {
        return blockNumber < block.number && blockNumber >= block.number - 256;
    }
}
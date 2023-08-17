// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract BlockHashValidator {

    function validateBlockHash(bytes5 truncatedBlockHash, uint40 blockNumber) external view {
        require(isBlockHashValid(truncatedBlockHash, blockNumber), "CBHV: Invalid block hash");
    }

    function isBlockHashValid(bytes5 blockHash, uint40 blockNumber) public view returns (bool) {
        if (!_isBlockWithinRange(uint256(blockNumber))) {
            return false;
        }
        return blockHash == bytes5(blockhash(uint256(blockNumber)));
    }

    /* ========== Internal functions ========== */

    function _isBlockWithinRange(uint256 blockNumber) internal view returns (bool) {
        return blockNumber < block.number && blockNumber >= block.number - 256;
    }
}
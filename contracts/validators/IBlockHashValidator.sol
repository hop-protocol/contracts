// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IBlockHashValidator {
    function validateBlockHash(bytes32 blockHash, uint256 blockNumber) external view;
    function isBlockHashValid(bytes32 blockHash, uint256 blockNumber) external view returns (bool);
    function getBlockHash(uint256 blockNumber) external view returns (bytes32);
}

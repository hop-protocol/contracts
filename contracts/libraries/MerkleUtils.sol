// SPDX-License-Identifier: UNLICENSED
// Source: https://github.com/ethereum-optimism/contracts-v2/blob/3c207136aa02f7426deffc5efdc4cb2e861ff218/contracts/optimistic-ethereum/libraries/utils/Lib_MerkleUtils.sol

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

/**
 * @title MerkleUtils
 */
library MerkleUtils {
    function getMerkleRoot(
        bytes32[] memory _hashes
    )
        internal
        pure
        returns (
            bytes32 _root
        )
    {
        require(
            _hashes.length > 0,
            "Must provide at least one leaf hash."
        );

        if (_hashes.length == 1) {
            return _hashes[0];
        }

        bytes32[] memory defaultHashes = _getDefaultHashes(_hashes.length);

        bytes32[] memory nodes = _hashes;
        if (_hashes.length % 2 == 1) {
            nodes = new bytes32[](_hashes.length + 1);
            for (uint256 i = 0; i < _hashes.length; i++) {
                nodes[i] = _hashes[i];
            }
        }

        uint256 currentLevel = 0;
        uint256 nextLevelSize = _hashes.length;
        
        if (nextLevelSize % 2 == 1) {
            nodes[nextLevelSize] = defaultHashes[currentLevel];
            nextLevelSize += 1;
        }

        while (nextLevelSize > 1) {
            currentLevel += 1;

            for (uint256 i = 0; i < nextLevelSize / 2; i++) {
                nodes[i] = _getParentHash(
                    nodes[i*2],
                    nodes[i*2 + 1]
                );
            }

            nextLevelSize = nextLevelSize / 2;

            if (nextLevelSize % 2 == 1 && nextLevelSize != 1) {
                nodes[nextLevelSize] = defaultHashes[currentLevel];
                nextLevelSize += 1;
            }
        }

        return nodes[0];
    }

    function _getDefaultHashes(
        uint256 _length
    )
        private
        pure
        returns (
            bytes32[] memory _defaultHashes
        )
    {
        bytes32[] memory defaultHashes = new bytes32[](_length);

        defaultHashes[0] = keccak256(abi.encodePacked(uint256(0)));
        for (uint256 i = 1; i < defaultHashes.length; i++) {
            defaultHashes[i] = keccak256(abi.encodePacked(defaultHashes[i-1]));
        }

        return defaultHashes;
    }

    function _getParentHash(
        bytes32 _leftChildHash,
        bytes32 _rightChildHash
    )
        private
        pure
        returns (
            bytes32 _hash
        )
    {
        return keccak256(abi.encodePacked(_leftChildHash, _rightChildHash));
    }
}
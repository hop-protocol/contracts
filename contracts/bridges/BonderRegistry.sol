// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "../interfaces/IBonderRegistry.sol";

contract BonderRegistry is IBonderRegistry {
    function isBonderAllowed(address bonder, uint256 credit) external view override returns (bool) {
        return true;
    }
}


// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

contract Initializable {
    bool initialized;

    modifier initializer() {
        require(!initialized, "Initializable: contract is already initialized");
        initialized = true;
        _;
    }
}

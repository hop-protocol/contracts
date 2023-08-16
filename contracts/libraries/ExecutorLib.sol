// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ExecutorLib {
    function execute(
        address to,
        bytes memory data,
        uint256 value
    ) internal returns (bytes memory) {
        (bool success, bytes memory res) = payable(to).call{value: value}(data);
        if (!success) {
            // Bubble up error message
            assembly { revert(add(res,0x20), res) }
        }
        return res;
    }
}

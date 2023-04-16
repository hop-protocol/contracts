// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

/**
 * @dev Define interface for PolygonZkEVM Bridge message receiver
 * https://github.com/0xPolygonHermez/zkevm-contracts/blob/main/contracts/interfaces/IBridgeMessageReceiver.sol
 */
interface IBridgeMessageReceiver {
    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external payable;
}

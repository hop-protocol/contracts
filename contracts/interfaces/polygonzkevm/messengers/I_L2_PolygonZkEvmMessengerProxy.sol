// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface I_L2_PolygonZkEvmMessengerProxy {
    function sendCrossDomainMessage(bytes memory message) external;
    function xDomainMessageSender() external view returns (address);
    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external;
}

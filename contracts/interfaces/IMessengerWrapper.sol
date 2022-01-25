// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12 <=0.8.9;
pragma experimental ABIEncoderV2;

interface IMessengerWrapper {
    function sendCrossDomainMessage(bytes memory _calldata) external;
    function verifySender(address l1BridgeCaller, bytes memory _data) external;
}

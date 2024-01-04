// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IConnector {
    function dispatchCrossDomainMessage(bytes memory message) external;
}

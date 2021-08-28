// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.4.21 <0.7.0;

interface IArbSys {
    function sendTxToL1(address destAddr, bytes calldata calldataForL1) external payable;
}

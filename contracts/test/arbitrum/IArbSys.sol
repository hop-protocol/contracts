pragma solidity >=0.4.21 <0.7.0;

contract IArbSys {
    function sendTxToL1(address destAddr, bytes calldata calldataForL1) external payable {}
}

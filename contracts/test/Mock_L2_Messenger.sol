// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./MockMessenger.sol";
import "./Mock_L1_Messenger.sol";

contract Mock_L2_Messenger is MockMessenger {

    Mock_L1_Messenger public targetMessenger;

    constructor (IERC20 _canonicalToken) public MockMessenger(_canonicalToken) {}

    function setTargetMessenger(address _targetMessenger) public {
        targetMessenger = Mock_L1_Messenger(_targetMessenger);
    }

    /* ========== Arbitrum ========== */

    function sendTxToL1(
        address _destAddr,
        bytes calldata _calldataForL1
    )
        external
        payable
    {
        targetMessenger.receiveMessage(
            _destAddr,
            _calldataForL1,
            msg.sender
        );
    }


    /* ========== Optimism ========== */

    function sendMessage(
        address _target,
        bytes calldata _message,
        uint32 _gasLimit
    )
        public
    {
        targetMessenger.receiveMessage(
            _target,
            _message,
            msg.sender
        );
    }
}

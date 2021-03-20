// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./MockMessenger.sol";
import "./Mock_L2_Messenger.sol";

contract Mock_L1_Messenger is MockMessenger {

    Mock_L2_Messenger public targetMessenger;

    constructor (IERC20 _canonicalToken) public MockMessenger(_canonicalToken) {}

    function setTargetMessenger(address _targetMessenger) public {
        targetMessenger = Mock_L2_Messenger(_targetMessenger);
    }

    /* ========== Arbitrum ========== */

    // TODO: Use a realistic value
    function bridge() external returns (address) {
        return address(0);
    }

    function sendContractTransaction(
        uint256 _defaultGasLimit,
        uint256 _defaultGasPrice,
        address _target,
        uint256 _value,
        bytes calldata _message
    )
        public
    {
        targetMessenger.receiveMessage(
            _target,
            _message,
            msg.sender
        );
    }

    function decodeMessage(bytes memory _message) internal pure returns (address, bytes memory) {
        uint256 targetAddressStart = 77; // 154 / 2
        uint256 targetAddressLength = 20; // 40 / 2
        bytes memory decodedTargetBytes = _message.slice(targetAddressStart, targetAddressLength);
        address decodedTarget;
        assembly {
            decodedTarget := mload(add(decodedTargetBytes,20))
        }


        // Define `setTransferRoot`, `mint` and `mintAndAttemptSwap` data lengths
        // "setTransferRoot(bytes32,uint256)" = (8+64*2) / 2= 136 / 2
        uint256 setTransferRootLength = 68;
        // mint(address,uint256,uint256) = (8+64*3) / 2 = 200 / 2
        uint256 mintLength = 100;
        // mintAndAttemptSwap(address,uint256,uint256,uint256,uint256) = (8+64*5) / 2 = 328 / 2
        uint256 mintAndAttemptSwapLength = 164;

        uint256 dataStart = 129;
        uint256 dataLength;
        if (_message.length == dataStart + setTransferRootLength) {
            dataLength = setTransferRootLength;
        } else if (_message.length == dataStart + mintLength) {
            dataLength = mintLength;
        } else if (_message.length == dataStart + mintAndAttemptSwapLength) {
            dataLength = mintAndAttemptSwapLength;
        }

        bytes memory decodedMessage = _message.slice(dataStart, dataLength);

        return (decodedTarget, decodedMessage);
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

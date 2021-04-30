// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./MockMessenger.sol";
import "./Mock_L2_Messenger.sol";

contract Mock_L1_Messenger is MockMessenger {

    Mock_L2_Messenger public targetMessenger;
    // This should be the L2_PolygonMessengerProxy
    address public polygonTarget;

    constructor (IERC20 _canonicalToken) public MockMessenger(_canonicalToken) {}

    function setTargetMessenger(address _targetMessenger) public {
        targetMessenger = Mock_L2_Messenger(_targetMessenger);
    }

    function setPolygonTarget(address _polygonTarget) public {
        polygonTarget = _polygonTarget;
    }

    /* ========== Arbitrum ========== */

    function createRetryableTicket(
        address _destAddr,
        uint256 _arbTxCallValue,
        uint256 _maxSubmissionCost,
        address _submissionRefundAddress,
        address _valueRefundAddress,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    )
        external
        payable
        returns (uint256)
    {
        targetMessenger.receiveMessage(
            _destAddr,
            _data,
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

    /* ========== xDai ========== */

    function requireToPassMessage(
        address _target,
        bytes calldata _message,
        uint256 _gasLimit
    )
        public
        returns (bytes32)
    {
        targetMessenger.receiveMessage(
            _target,
            _message,
            msg.sender
        );

        return bytes32('0');
    }

    /* ========== Polygon ========== */

    /// NOTE: Calling `_sendMessageToChild()` would be the consistent thing to do, however that is an internal
    // function, so we are bypassing it with `syncState()`
    function syncState(
        address _childTunnel,
        bytes memory _message
    )
        public
    {
        bytes memory customMessage;
        if (isContract(msg.sender)) {
            // Polygon's implementation uses the L1 bridge as the message sender instead of the messenger wrapper
            // We need to decode and re-encode the values
            (, bytes memory message) = abi.decode(_message, (address, bytes));
            customMessage = abi.encode(msg.sender, message);
        } else {
            // When calling from an EOA, we use the expected message
            customMessage = _message;
        }

        targetMessenger.receiveMessage(
            polygonTarget,
            customMessage,
            msg.sender
        );
    }

    // TODO: Handle this better
    function syncStateCanonicalToken(
        address _target,
        bytes memory _message
    )
        public
    {
        targetMessenger.receiveMessage(
            _target,
            _message,
            msg.sender
        );
    }

    function isContract(address _addr) private returns (bool isContract){
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }
}

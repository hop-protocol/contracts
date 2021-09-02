// SPDX-License-Identifier: MIT
// @unsupported: ovm

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/arbitrum/messengers/IInbox.sol";
import "../interfaces/arbitrum/messengers/IBridge.sol";
import "../interfaces/arbitrum/messengers/IOutbox.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Arbitrum - https://developer.offchainlabs.com/
 * @notice Deployed on layer-1
 */

contract ArbitrumMessengerWrapper is MessengerWrapper {

    IInbox public arbInbox;
    uint256 public immutable defaultGasPrice;
    uint256 public immutable defaultCallValue;
    address public immutable l2BridgeAddress;
    uint256 public immutable defaultGasLimit;

    constructor(
        address _l1Address,
        address _l2BridgeAddress,
        IInbox _arbInbox,
        uint256 _defaultGasLimit,
        uint256 _defaultGasPrice,
        uint256 _defaultCallValue
    )
        public
        MessengerWrapper(_l1Address)
    {
        l2BridgeAddress = _l2BridgeAddress;
        arbInbox = _arbInbox;
        defaultGasLimit = _defaultGasLimit;
        defaultGasPrice = _defaultGasPrice;
        defaultCallValue = _defaultCallValue;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public payable override onlyL1Address {
        uint256 maxSubmissionCost = defaultGasLimit * defaultGasPrice;
        arbInbox.createRetryableTicket{value: msg.value}(
            l2BridgeAddress,
            0,
            0,
            tx.origin,
            address(0),
            100000000000,
            0,
            _calldata
        );
    }

    function verifySender(address l1Caller) public override {
        IBridge arbBridge = arbInbox.bridge();
        IOutbox outbox = IOutbox(arbBridge.activeOutbox());

        require(l1Caller == address(outbox), "ARB_MSG_WPR: Caller is not outbox");
        // Verify that sender is l2BridgeAddress
        require(outbox.l2ToL1Sender() == l2BridgeAddress, "ARB_MSG_WPR: Invalid cross-domain sender");
    }
}

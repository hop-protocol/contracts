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

    uint256 public immutable defaultGasPrice;
    uint256 public immutable defaultCallValue;
    uint256 public immutable defaultGasLimit;
    IInbox public arbInbox;
    address public l2BridgeConnectorAddress;

    constructor(
        address _l1Address,
        IInbox _arbInbox,
        uint256 _defaultGasLimit,
        uint256 _defaultGasPrice,
        uint256 _defaultCallValue
    )
        public
        MessengerWrapper(_l1Address)
    {
        arbInbox = _arbInbox;
        defaultGasLimit = _defaultGasLimit;
        defaultGasPrice = _defaultGasPrice;
        defaultCallValue = _defaultCallValue;
    }

    /**
     * @dev Sets the l2BridgeConnectorAddress
     * @param _l2BridgeConnectorAddress The new bridge connector address
     */
    function setL2BridgeConnectorAddress(address _l2BridgeConnectorAddress) external {
        require(l2BridgeConnectorAddress == address(0), "MSG_WRPR: Connector address has been set");
        l2BridgeConnectorAddress = _l2BridgeConnectorAddress;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public payable override onlyL1Address {
        uint256 maxSubmissionCost = defaultGasLimit * defaultGasPrice;
        arbInbox.createRetryableTicket{value: msg.value}(
            l2BridgeConnectorAddress,
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
        // Verify that sender is l2BridgeConnectorAddress
        require(outbox.l2ToL1Sender() == l2BridgeConnectorAddress, "ARB_MSG_WPR: Invalid cross-domain sender");
    }
}

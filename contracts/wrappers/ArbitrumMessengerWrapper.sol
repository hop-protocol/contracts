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

    IInbox public immutable l1MessengerAddress;
    address public l2BridgeAddress;
    uint256 public maxSubmissionCost;
    address public l1MessengerWrapperAlias;
    uint256 public maxGas;
    uint256 public gasPriceBid;


    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IInbox _l1MessengerAddress,
        uint256 _maxSubmissionCost,
        address _l1MessengerWrapperAlias,
        uint256 _maxGas,
        uint256 _gasPriceBid
        
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        l1MessengerAddress = _l1MessengerAddress;
        maxSubmissionCost = _maxSubmissionCost;
        l1MessengerWrapperAlias = _l1MessengerWrapperAlias;
        maxGas = _maxGas;
        gasPriceBid = _defaultGasPrice;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        l1MessengerAddress.createRetryableTicket(
            l2BridgeAddress,
            0,
            maxSubmissionCost,
            l1MessengerWrapperAlias,
            l1MessengerWrapperAlias,
            maxGas,
            gasPriceBid,
            _calldata
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        IBridge arbBridge = l1MessengerAddress.bridge();
        IOutbox outbox = IOutbox(arbBridge.activeOutbox());

        require(l1BridgeCaller == address(outbox), "ARB_MSG_WPR: Caller is not outbox");
        // Verify that sender is l2BridgeAddress
        require(outbox.l2ToL1Sender() == l2BridgeAddress, "ARB_MSG_WPR: Invalid cross-domain sender");
    }

    // TODO: Add setters for createRetryableTicketParams

    function claimL2Funds(
        address _recipient,
        address _recipientAlias,
        uint256 _l2CallValue,
        uint256 _maxSubmissionCost,
        uint256 _maxGas
    )
        public
        onlyGovernance
    {
        l1MessengerAddress.createRetryableTicket(
            _recipientAlias,
            _l2CallValue,
            _maxSubmissionCost,
            _recipient,
            _recipient,
            _maxGas,
            gasPriceBid,
            ""
        );
    }
}

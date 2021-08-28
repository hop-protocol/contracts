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
    uint256 public immutable defaultGasPrice;
    address public immutable l2BridgeAddress;
    uint256 public immutable defaultGasLimit;
    uint256 public immutable defaultSubMessageType = 1;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IInbox _l1MessengerAddress,
        uint256 _defaultGasLimit,
        uint256 _defaultGasPrice,
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        defaultGasLimit = _defaultGasLimit;
        defaultGasPrice = _defaultGasPrice;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        bytes memory subMessage = abi.encode(
            defaultGasLimit,
            defaultGasPrice,
            uint256(l2BridgeAddress),
            0,
            _callData
        );
        bytes memory prefixedSubMessage = abi.encodePacked(
            defaultSubMessageType,
            subMessage
        );
        l1MessengerAddress.sendL2Message(
            prefixedSubMessage
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        IBridge arbBridge = l1MessengerAddress.bridge();
        IOutbox outbox = IOutbox(arbBridge.activeOutbox());

        require(l1BridgeCaller == address(outbox), "ARB_MSG_WPR: Caller is not outbox");
        // Verify that sender is l2BridgeAddress
        require(outbox.l2ToL1Sender() == l2BridgeAddress, "ARB_MSG_WPR: Invalid cross-domain sender");
    }
}

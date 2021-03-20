// SPDX-License-Identifier: MIT

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
    IBridge public arbBridge;
    uint256 public defaultGasPrice;
    uint256 public defaultCallValue;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        uint256 _defaultGasLimit,
        IInbox _arbInbox,
        uint256 _defaultGasPrice,
        uint256 _defaultCallValue
    )
        public
    {
        l1BridgeAddress = _l1BridgeAddress;
        l2BridgeAddress = _l2BridgeAddress;
        defaultGasLimit = _defaultGasLimit;
        arbInbox = _arbInbox;
        arbBridge = arbInbox.bridge();
        defaultGasPrice = _defaultGasPrice;
        defaultCallValue = _defaultCallValue;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        arbInbox.sendContractTransaction(defaultGasLimit, defaultGasPrice, l2BridgeAddress, 0, _calldata);
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        require(l1BridgeCaller == address(arbBridge), "ARB_MSG_WPR: Caller is not arbBridge");
        // Verify that sender is l2BridgeAddress
        require(IOutbox(arbBridge.activeOutbox()).l2ToL1Sender() == l2BridgeAddress, "ARB_MSG_WPR: Invalid cross-domain sender");
    }
}

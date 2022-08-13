// SPDX-License-Identifier: MIT
// @unsupported: ovm

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/arbitrum/messengers/IInbox.sol";
import "../interfaces/arbitrum/messengers/IBridge.sol";
import "../interfaces/arbitrum/messengers/IOutbox.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Arbitrum - https://developer.offchainlabs.com/
 * @notice Deployed on layer-1
 */

contract ArbitrumMessengerWrapper is MessengerWrapper, Ownable {

    IInbox public immutable l1MessengerAddress;
    address public l2BridgeAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IInbox _l1MessengerAddress
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        l1MessengerAddress = _l1MessengerAddress;
    }

    receive() external payable {}

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        uint256 submissionFee = l1MessengerAddress.calculateRetryableSubmissionFee(_calldata.length, 0);
        l1MessengerAddress.unsafeCreateRetryableTicket{value: submissionFee}(
            l2BridgeAddress,
            0,
            submissionFee,
            address(0),
            address(0),
            0,
            0,
            _calldata
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        // Reference: https://github.com/OffchainLabs/arbitrum/blob/5c06d89daf8fa6088bcdba292ffa6ed0c72afab2/packages/arb-bridge-peripherals/contracts/tokenbridge/ethereum/L1ArbitrumMessenger.sol#L89
        IBridge arbBridge = l1MessengerAddress.bridge();
        IOutbox outbox = IOutbox(arbBridge.activeOutbox());
        address l2ToL1Sender = outbox.l2ToL1Sender();

        require(l1BridgeCaller == address(arbBridge), "ARB_MSG_WPR: Caller is not the bridge");
        require(l2ToL1Sender == l2BridgeAddress, "ARB_MSG_WPR: Invalid cross-domain sender");
    }

    /**
     * @dev Claim excess funds
     * @param recipient The recipient to send to
     * @param amount The amount to claim
     */
    function claimFunds(address payable recipient, uint256 amount) public onlyOwner {
        recipient.transfer(amount);
    }
}

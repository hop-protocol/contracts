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
    address public l1MessengerWrapperAlias;
    uint160 constant offset = uint160(0x1111000000000000000000000000000000001111);

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
        l1MessengerWrapperAlias = applyL1ToL2Alias(address(this));
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        uint256 submissionFee = l1MessengerAddress.calculateRetryableSubmissionFee(_calldata.length, 0);
        l1MessengerAddress.unsafeCreateRetryableTicket(
            l2BridgeAddress,
            0,
            submissionFee,
            l1MessengerWrapperAlias,
            l1MessengerWrapperAlias,
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
     * @dev Claim funds that exist on the l2 messenger wrapper alias address
     * @notice Do not use state variables here as this is to be used when passing in precise values
     */
    function claimL2Funds(
        address _to,
        uint256 _l2CallValue,
        uint256 _maxSubmissionCost,
        uint256 _gasLimit,
        uint256 _maxFeePerGas
    )
        public
        onlyOwner
    {
        l1MessengerAddress.unsafeCreateRetryableTicket(
            _to,
            _l2CallValue,
            _maxSubmissionCost,
            _to,
            _to,
            _gasLimit,
            _maxFeePerGas,
            ""
        );
    }

    /// @notice Utility function that converts the msg.sender viewed in the L2 to the
    /// address in the L1 that submitted a tx to the inbox
    /// @param l1Address L2 address as viewed in msg.sender
    /// @return The address in the L1 that triggered the tx to L2
    function applyL1ToL2Alias(address l1Address) internal pure returns (address) {
        return address(uint160(l1Address) + offset);
    }

    /* ========== External Config Management Functions ========== */

    function setL1MessengerWrapperAlias(address _newL1MessengerWrapperAlias) external onlyOwner {
        l1MessengerWrapperAlias = _newL1MessengerWrapperAlias;
    }
}

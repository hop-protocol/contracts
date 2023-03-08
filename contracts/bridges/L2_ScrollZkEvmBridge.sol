// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/scroll/messengers/IL2ScrollMessenger.sol";
import "./L2_Bridge.sol";

/**
 * @dev A MessengerWrapper for the Scroll zkEVM - https://scroll.io/alpha
 */

contract L2_ScrollZkEvmBridge is L2_Bridge {

    // Scroll needs this to receive funds to pay for L2 to L1 messages.
    // TODO: This only applies on testnet and should be removed for production.
    receive() external payable {}

    IL2ScrollMessenger public scrollMessengerAddress;

    constructor (
        IL2ScrollMessenger _scrollMessengerAddress,
        address l1Governance,
        HopBridgeToken hToken,
        address l1BridgeAddress,
        uint256[] memory activeChainIds,
        address[] memory bonders
    )
        public
        L2_Bridge(
            l1Governance,
            hToken,
            l1BridgeAddress,
            activeChainIds,
            bonders
        )
    {
        scrollMessengerAddress = _scrollMessengerAddress;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        uint256 fee = 0.01 ether; // TODO: fetch fee
        uint256 gasLimit = 500000; // TODO: determine appropriate gas fee
        scrollMessengerAddress.sendMessage{value: fee}(
            l1BridgeAddress,
            0, // value
            message,
            gasLimit
        );
    }

    function _verifySender(address expectedSender) internal override {
        require(scrollMessengerAddress.xDomainMessageSender() == expectedSender, "L2_SCRL_BRG: Invalid cross-domain sender");
        require(msg.sender == address(scrollMessengerAddress), "L2_SCRL_BRG: Caller is not the expected sender");
    }
}

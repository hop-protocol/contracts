// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/linea/messengers/IBridge.sol";
import "./L2_Bridge.sol";

/**
 * @dev A MessengerWrapper for Linea - https://docs.linea.build/
 */

contract L2_LineaBridge is L2_Bridge {

    // Linea needs this to receive funds to pay for L2 to L1 messages.
    // TODO: This only applies on testnet and should be removed for production.
    receive() external payable {}

    IBridge public lineaMessengerAddress;

    constructor (
        IBridge _lineaMessengerAddress,
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
        lineaMessengerAddress = _lineaMessengerAddress;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        uint256 fee = lineaMessengerAddress.minimumFee(); 
        lineaMessengerAddress.sendMessage{value: fee}(
            l1BridgeAddress,
            fee,
            9999999999, // Unlimited deadline
            message
        );
    }

    function _verifySender(address expectedSender) internal override {
        require(lineaMessengerAddress.sender() == expectedSender, "L2_LINEA_BRG: Invalid cross-domain sender");
        require(msg.sender == address(lineaMessengerAddress), "L2_LINEA_BRG: Caller is not the expected sender");
    }
}

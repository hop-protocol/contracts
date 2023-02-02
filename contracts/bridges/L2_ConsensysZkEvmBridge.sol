// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/consensys/messengers/IBridge.sol";
import "./L2_Bridge.sol";

/**
 * @dev A MessengerWrapper for the ConsenSys zkEVM - https://consensys.net/docs/zk-evm/en/latest/
 */

contract L2_ConsensysZkEvmBridge is L2_Bridge {

    // Consensys needs this to receive funds to pay for L2 to L1 messages.
    // TODO: This only applies on testnet and should be removed for production.
    receive() external payable {}

    IBridge public consensysMessengerAddress;

    constructor (
        IBridge _consensysMessengerAddress,
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
        consensysMessengerAddress = _consensysMessengerAddress;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        uint256 fee = consensysMessengerAddress.minimumFee(); 
        consensysMessengerAddress.dispatchMessage{value: fee}(
            l1BridgeAddress,
            fee,
            9999999999, // Unlimited deadline
            message
        );
    }

    function _verifySender(address expectedSender) internal override {
        require(consensysMessengerAddress.sender() == expectedSender, "L2_CSYS_BRG: Invalid cross-domain sender");
        require(msg.sender == address(consensysMessengerAddress), "L2_CSYS_BRG: Caller is not the expected sender");
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/polygonzkevm/messengers/IL2PolygonZkEvmMessenger.sol";
import "./L2_Bridge.sol";

/**
 * @dev A MessengerWrapper for the Polygon zkEVM - https://polygon.technology/polygon-zkevm
 */

contract L2_PolygonZkEvmBridge is L2_Bridge {
    IL2PolygonZkEvmMessenger public polygonZkEvmMessengerAddress;

    constructor (
        IL2PolygonZkEvmMessenger _polygonZkEvmMessengerAddress,
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
        polygonZkEvmMessengerAddress = _polygonZkEvmMessengerAddress;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        uint32 destinationNetwork = 0; // L1
        bool forceUpdateGlobalExitRoot = true;
        polygonZkEvmMessengerAddress.bridgeMessage{value: 0}(
          destinationNetwork,
          l1BridgeAddress,
          forceUpdateGlobalExitRoot,
          message
        );
    }

    // TODO: verify sender
    function _verifySender(address expectedSender) internal override {
        require(msg.sender == address(polygonZkEvmMessengerAddress), "L2_PLGNZK_BRG: Caller is not the expected sender");
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/zksync/messengers/IL2Messenger.sol";
import "./L2_Bridge.sol";

/**
 * @dev A MessengerWrapper for ZKSync - https://v2-docs.zksync.io/dev/developer-guides/bridging/l2-l1.html#sending-a-message-from-l2-to-l1
 */

contract L2_ZkSyncBridge is L2_Bridge {

    IL2Messenger public zkSyncMessengerAddress;

    constructor (
        IL2Messenger _zkSyncMessengerAddress,
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
        zkSyncMessengerAddress = _zkSyncMessengerAddress;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        zkSyncMessengerAddress.sendToL1(message);
    }

    function _verifySender(address expectedSender) internal override {
        require(msg.sender == expectedSender, "L2_ZKSYNC_BRG: Caller is not the expected sender");
    }
}

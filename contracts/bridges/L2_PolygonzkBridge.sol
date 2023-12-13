// SPDX-License-Identifier: MIT
// @unsupported: ovm

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./L2_Bridge.sol";
import "../polygonzk/PolygonzkBridgeMessageReceiver.sol";
import "../interfaces/polygonzk/messengers/IPolygonZkEVMBridge.sol";

/**
 * @dev An L2_Bridge for Polygonzk - https://zkevm.polygon.technology/docs/protocol/transaction-execution
 */

contract L2_PolygonzkBridge is L2_Bridge, PolygonzkBridgeMessageReceiver {

    IPolygonZkEVMBridge public immutable messenger;
    uint256 public constant L1_NETWORK = 0;
    bool public constant FORCE_UPDATE_GLOBAL_EXIT_ROOT = false;

    constructor (
        IPolygonZkEVMBridge _messenger,
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
        PolygonzkBridgeMessageReceiver()
    {
        messenger = _messenger;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        messenger.bridgeMessage(
            uint32(L1_NETWORK),
            l1BridgeCaller,
            FORCE_UPDATE_GLOBAL_EXIT_ROOT,
            message
        );
    }

    function _verifySender(address expectedSender) internal override {
        require(msg.sender == address(this), "L2_PLY_ZK_BRG: Caller is not the expected sender");
        require(xDomainMessageSender == expectedSender, "L2_PLY_ZK_BRG: Invalid cross-domain sender");
        require(xDomainNetwork == L1_NETWORK, "L2_PLY_ZK_BRG: Invalid cross-domain network");
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external {
        _onMessageReceived(
            originAddress,
            originNetwork,
            data,
            address(this),
            address(messenger)
        );
    }
}


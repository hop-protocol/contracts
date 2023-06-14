// SPDX-License-Identifier: MIT
// @unsupported: ovm

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./L2_Bridge.sol";
import "../interfaces/polygonzk/messengers/IPolygonZkEVMBridge.sol";
import "../interfaces/polygonzk/bridges/IBridgeMessageReceiver.sol";

/**
 * @dev An L2_Bridge for Polygonzk - https://zkevm.polygon.technology/docs/protocol/transaction-execution
 */

contract L2_PolygonzkBridge is L2_Bridge {

    IPolygonZkEVMBridge public immutable messenger;
    IBridgeMessageReceiver public l1BridgeReceiver;

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
    {
        messenger = _messenger;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        messenger.bridgeMessage(
            0,
            l1BridgeReceiver,
            false,
            message
        );
    }

    function _verifySender(address expectedSender) internal override {
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external {
        require(msg.sender == address(messenger), "L2_PLY_ZK_BRG: Caller is not the messenger");
        require(fromNetworkId == 0, "L2_PLY_ZK_BRG: Origin network is not expected");

        (bool success,) = address(this).call(data);
        require(success, "L2_PLY_ZK_BRG: Call to L1 Bridge failed");
    }

    function setL1bridgeReceiver(IBridgeMessageReceiver _l1BridgeReceiver) external onlyGovernance {
        l1BridgeReceiver = _l1BridgeReceiver;
    }
}


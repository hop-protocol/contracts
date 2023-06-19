// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../polygonzk/PolygonzkBridgeMessageReceiver.sol";
import "../interfaces/polygonzk/messengers/IPolygonZkEVMBridge.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Polygonzk - https://zkevm.polygon.technology/docs/protocol/bridge-smart-contract
 * @notice Deployed on layer-1
 */

// TODO: Not ownable if it doesn't need to be
contract PolygonzkMessengerWrapper is MessengerWrapper, Ownable, PolygonzkBridgeMessageReceiver {

    IPolygonZkEVMBridge public immutable l1Messenger;
    address public l2BridgeAddress;
    uint256 public constant l2Network = 1;
    bool public constant forceUpdateGlobalExitRoot = false;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IPolygonZkEVMBridge _l1Messenger,
        uint256 _l2ChainId
    )
        public
        MessengerWrapper(_l1BridgeAddress, _l2ChainId)
        PolygonzkBridgeMessageReceiver()
    {
        l2BridgeAddress = _l2BridgeAddress;
        l1Messenger = _l1Messenger;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        l1Messenger.bridgeMessage(
            uint32(l2Network),
            l2BridgeAddress,
            forceUpdateGlobalExitRoot,
            _calldata
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        if (isRootConfirmation) return;

        require(l1BridgeCaller == address(this), "L1_PLGN_ZK_WPR: Caller must be this address");
        require(xDomainMessageSender == l2BridgeAddress, "L1_PLGN_ZK_WPR: Invalid cross-domain sender");
        require(xDomainNetwork == l2Network, "L1_PLGN_ZK_WPR: Invalid cross-domain network");
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external {
        _onMessageReceived(originAddress, originNetwork, data, address(l1Messenger), l2Network, l1BridgeAddress);
    }
}

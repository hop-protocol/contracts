// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/polygonzk/messengers/IPolygonZkEVMBridge.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Polygonzk - https://zkevm.polygon.technology/docs/protocol/bridge-smart-contract
 * @notice Deployed on layer-1
 */

// TODO: Not ownable if it doesn't need to be
contract PolygonzkMessengerWrapper is MessengerWrapper, Ownable {

    IPolygonZkEVMBridge public immutable l1MessengerAddress;
    address public l2BridgeAddress;
    // TODO: Immutable? if not, add setter and owner.
    address public immutable polygonZkBridgeMessageReceiverAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IPolygonZkEVMBridge _l1MessengerAddress,
        uint256 _l2ChainId,
        address _polygonZkBridgeMessageReceiverAddress
    )
        public
        MessengerWrapper(_l1BridgeAddress, _l2ChainId)
    {
        l2BridgeAddress = _l2BridgeAddress;
        l1MessengerAddress = _l1MessengerAddress;
        polygonZkBridgeMessageReceiverAddress = _polygonZkBridgeMessageReceiverAddress;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        l1MessengerAddress.bridgeMessage(
            l2ChainId
            1,
            true,
            _calldata
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        if (isRootConfirmation) return;

        require(l1BridgeCaller == polygonZkBridgeMessageReceiverAddress, "L1_PLGN_ZK_WPR: Caller must be bridge receiver contract");
    }
}

// SPDX-License-Identifier: MIT
// @unsupported: ovm

pragma solidity 0.8.9;
pragma experimental ABIEncoderV2;

import "../polygon/tunnel/FxBaseRootTunnel.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Polygon - https://docs.matic.network/docs
 * @notice Deployed on layer-1
 */

contract PolygonMessengerWrapper is FxBaseRootTunnel, MessengerWrapper {

    constructor(
        address _l1BridgeAddress,
        address _checkpointManager,
        address _fxRoot,
        address _fxChildTunnel
    )
        public
        MessengerWrapper(_l1BridgeAddress)
        FxBaseRootTunnel(_checkpointManager, _fxRoot)
    {
        setFxChildTunnel(_fxChildTunnel);
    }

    /** 
     * @dev Sends a message to the l2MessengerProxy from layer-1
     * @param _calldata The data that l2MessengerProxy will be called with
     * @notice The msg.sender is sent to the L2_PolygonMessengerProxy and checked there.
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override {
        _sendMessageToChild(
            abi.encode(msg.sender, _calldata)
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public view override {
        require(l1BridgeCaller == address(this), "L1_PLGN_WPR: Caller must be this contract");
    }

    function _processMessageFromChild(bytes memory message) internal override {
        (bool success,) = l1BridgeAddress.call(message);
        require(success, "L1_PLGN_WPR: Call to L1 Bridge failed");
    }
}

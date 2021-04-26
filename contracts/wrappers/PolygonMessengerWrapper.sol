// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../polygon/tunnel/BaseRootTunnel.sol";
import "./MessengerWrapper.sol";
import "../bridges/L1_Bridge.sol";

/**
 * @dev A MessengerWrapper for Polygon - https://docs.matic.network/docs
 * @notice Deployed on layer-1
 */

contract PolygonMessengerWrapper is BaseRootTunnel, MessengerWrapper {

    constructor(
        address _l1BridgeAddress
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {}

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

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        require(l1BridgeCaller == address(this), "L1_PLGN_WPR: Caller must be this contract");
    }

    function _processMessageFromChild(bytes memory message) internal override {
        (bool success,) = l1BridgeAddress.call(message);
        require(success, "L1_PLGN_WPR: Call to L1 Bridge failed");
    }
}

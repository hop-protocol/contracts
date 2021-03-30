// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/polygon/IStateSender.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Polygon - https://docs.matic.network/docs
 * @notice Deployed on layer-1
 */

contract PolygonMessengerWrapper is MessengerWrapper {

    address l2MessengerProxy;
    IStateSender public l1MessengerAddress;
    address public predicate;

    constructor(
        address _l2MessengerProxy,
        IStateSender _l1MessengerAddress,
        address _predicate
    )
        public
    {
        l2MessengerProxy = _l2MessengerProxy;
        l1MessengerAddress = _l1MessengerAddress;
        predicate = _predicate;
    }

    /** 
     * @dev Sends a message to the l2MessengerProxy from layer-1
     * @param _calldata The data that l2MessengerProxy will be called with
     * @notice The msg.sender is sent to the L2_PolygonMessengerProxy and checked there.
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override {
        l1MessengerAddress.syncState(
            l2MessengerProxy,
            abi.encode(msg.sender, _calldata)
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        require(l1BridgeCaller == predicate, "L2_PLGN_WPR: Caller must be predicate contract");
    }
}

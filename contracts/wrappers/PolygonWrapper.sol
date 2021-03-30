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

    IStateSender public l1MessengerAddress;
    address public predicate;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        uint256 _defaultGasLimit,
        IStateSender _l1MessengerAddress,
        address _predicate
    )
        public
    {
        l1BridgeAddress = _l1BridgeAddress;
        l2BridgeAddress = _l2BridgeAddress;
        defaultGasLimit = _defaultGasLimit;
        l1MessengerAddress = _l1MessengerAddress;
        predicate = _predicate;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     * @notice The msg.sender is sent to the L2_PolygonMessengerProxy and checked there.
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override {
        l1MessengerAddress.syncState(
            l2BridgeAddress,
            abi.encode(msg.sender, _calldata)
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        require(l1BridgeCaller == predicate, "L2_PLGN_WPR: Caller must be predicate contract");
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/optimism/messengers/iOVM_L1CrossDomainMessenger.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Optimism - https://community.optimism.io/docs/
 * @notice Deployed on layer-1
 */

contract OptimismMessengerWrapper is MessengerWrapper {

    iOVM_L1CrossDomainMessenger public l1MessengerAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        uint256 _defaultGasLimit,
        iOVM_L1CrossDomainMessenger _l1MessengerAddress
    )
        public
    {
        l1BridgeAddress = _l1BridgeAddress;
        l2BridgeAddress = _l2BridgeAddress;
        defaultGasLimit = _defaultGasLimit;
        l1MessengerAddress = _l1MessengerAddress;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        l1MessengerAddress.sendMessage(
            l2BridgeAddress,
            _calldata,
            uint32(defaultGasLimit)
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        require(l1BridgeCaller == address(l1MessengerAddress), "OVM_MSG_WPR: Caller is not l1MessengerAddress");
        // Verify that cross-domain sender is l2BridgeAddress
        require(l1MessengerAddress.xDomainMessageSender() == l2BridgeAddress, "OVM_MSG_WPR: Invalid cross-domain sender");
    }
}

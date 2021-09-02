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

    iOVM_L1CrossDomainMessenger public immutable l1MessengerAddress;
    uint256 public immutable defaultGasLimit;
    address public l2BridgeConnectorAddress;

    constructor(
        address _l1Address,
        iOVM_L1CrossDomainMessenger _l1MessengerAddress,
        uint256 _defaultGasLimit
    )
        public
        MessengerWrapper(_l1Address)
    {
        l1MessengerAddress = _l1MessengerAddress;
        defaultGasLimit = _defaultGasLimit;
    }

    /**
     * @dev Sets the l2BridgeConnectorAddress
     * @param _l2BridgeConnectorAddress The new bridge connector address
     */
    function setL2BridgeConnectorAddress(address _l2BridgeConnectorAddress) external {
        require(l2BridgeConnectorAddress == address(0), "MSG_WRPR: Connector address has been set");
        l2BridgeConnectorAddress = _l2BridgeConnectorAddress;
    }

    /** 
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public payable override onlyL1Address {
        l1MessengerAddress.sendMessage(
            l2BridgeConnectorAddress,
            _calldata,
            uint32(defaultGasLimit)
        );
    }

    function verifySender(address l1Caller) public override {
        require(l1Caller == address(l1MessengerAddress), "OVM_MSG_WPR: Caller is not l1MessengerAddress");
        // Verify that cross-domain sender is l2BridgeConnectorAddress
        require(l1MessengerAddress.xDomainMessageSender() == l2BridgeConnectorAddress, "OVM_MSG_WPR: Invalid cross-domain sender");
    }
}

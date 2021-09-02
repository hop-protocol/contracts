// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/xDai/messengers/IArbitraryMessageBridge.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for xDai - https://www.xdaichain.com/ (also see https://docs.tokenbridge.net/)
 * @notice Deployed on layer-1
 */

contract XDaiMessengerWrapper is MessengerWrapper {

    IArbitraryMessageBridge public l1MessengerAddress;
    /// @notice The xDai AMB uses bytes32 for chainId instead of uint256
    bytes32 public l2ChainId;
    address public ambBridge;
    address public l2BridgeConnectorAddress;
    uint256 public immutable defaultGasLimit;

    constructor(
        address _l1Address,
        address _l2BridgeAddress,
        IArbitraryMessageBridge _l1MessengerAddress,
        uint256 _defaultGasLimit,
        uint256 _l2ChainId,
        address _ambBridge
    )
        public
        MessengerWrapper(_l1Address)
    {
        l1MessengerAddress = _l1MessengerAddress;
        defaultGasLimit = _defaultGasLimit;
        l2ChainId = bytes32(_l2ChainId);
        ambBridge = _ambBridge;
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
        l1MessengerAddress.requireToPassMessage(
            l2BridgeConnectorAddress,
            _calldata,
            defaultGasLimit
        );
    }

    /// @notice message data is not needed for message verification with the xDai AMB
    function verifySender(address l1Caller) public override {
        require(l1MessengerAddress.messageSender() == l2BridgeConnectorAddress, "L2_XDAI_BRG: Invalid cross-domain sender");
        require(l1Caller == ambBridge, "L2_XDAI_BRG: Caller is not the expected sender");

        // With the xDai AMB, it is best practice to also check the source chainId
        // https://docs.tokenbridge.net/amb-bridge/how-to-develop-xchain-apps-by-amb#receive-a-method-call-from-the-amb-bridge
        require(l1MessengerAddress.messageSourceChainId() == l2ChainId, "L2_XDAI_BRG: Invalid source Chain ID");
    }
}

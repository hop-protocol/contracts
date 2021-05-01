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
    address public immutable l2BridgeAddress;
    uint256 public immutable defaultGasLimit;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IArbitraryMessageBridge _l1MessengerAddress,
        uint256 _defaultGasLimit,
        uint256 _l2ChainId,
        address _ambBridge
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        l1MessengerAddress = _l1MessengerAddress;
        defaultGasLimit = _defaultGasLimit;
        l2ChainId = bytes32(_l2ChainId);
        ambBridge = _ambBridge;
    }

    /**
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        l1MessengerAddress.requireToPassMessage(
            l2BridgeAddress,
            _calldata,
            defaultGasLimit
        );
    }

    /// @notice message data is not needed for message verification with the xDai AMB
    function verifySender(address l1BridgeCaller, bytes memory) public override {
        require(l1MessengerAddress.messageSender() == l2BridgeAddress, "L2_XDAI_BRG: Invalid cross-domain sender");
        require(l1BridgeCaller == ambBridge, "L2_XDAI_BRG: Caller is not the expected sender");

        // With the xDai AMB, it is best practice to also check the source chainId
        // https://docs.tokenbridge.net/amb-bridge/how-to-develop-xchain-apps-by-amb#receive-a-method-call-from-the-amb-bridge
        require(l1MessengerAddress.messageSourceChainId() == l2ChainId, "L2_XDAI_BRG: Invalid source Chain ID");
    }
}

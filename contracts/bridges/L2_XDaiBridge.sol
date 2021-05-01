// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/xDai/messengers/IArbitraryMessageBridge.sol";
import "./L2_Bridge.sol";

/**
 * @dev An L2_Bridge for xDai - https://www.xdaichain.com/ (also see https://docs.tokenbridge.net/)
 */

contract L2_XDaiBridge is L2_Bridge {
    IArbitraryMessageBridge public messenger;
    /// @notice The xDai AMB uses bytes32 for chainId instead of uint256
    bytes32 public immutable l1ChainId;
    uint256 public defaultGasLimit;

    constructor (
        IArbitraryMessageBridge _messenger,
        address l1Governance,
        HopBridgeToken hToken,
        address l1BridgeAddress,
        uint256[] memory activeChainIds,
        address[] memory bonders,
        uint256 _l1ChainId,
        uint256 _defaultGasLimit
    )
        public
        L2_Bridge(
            l1Governance,
            hToken,
            l1BridgeAddress,
            activeChainIds,
            bonders
        )
    {
        messenger = _messenger;
        l1ChainId = bytes32(_l1ChainId);
        defaultGasLimit = _defaultGasLimit;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        messenger.requireToPassMessage(
            l1BridgeAddress,
            message,
            defaultGasLimit
        );
    }

    function _verifySender(address expectedSender) internal override {
        require(messenger.messageSender() == expectedSender, "L2_XDAI_BRG: Invalid cross-domain sender");
        require(msg.sender == address(messenger), "L2_XDAI_BRG: Caller is not the expected sender");

        // With the xDai AMB, it is best practice to also check the source chainId
        // https://docs.tokenbridge.net/amb-bridge/how-to-develop-xchain-apps-by-amb#receive-a-method-call-from-the-amb-bridge
        require(messenger.messageSourceChainId() == l1ChainId, "L2_XDAI_BRG: Invalid source Chain ID");
    }

    /**
     * @dev Allows the L1 Bridge to set the messenger
     * @param _messenger The new messenger address
     */
    function setMessenger(IArbitraryMessageBridge _messenger) external onlyGovernance {
        messenger = _messenger;
    }

    function setDefaultGasLimit(uint256 _defaultGasLimit) external onlyGovernance {
        defaultGasLimit = _defaultGasLimit;
    }
}

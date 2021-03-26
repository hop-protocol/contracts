// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/xDai/messengers/iArbitraryMessageBridge.sol";
import "./L2_Bridge.sol";

/**
 * @dev An L2_Bridge for xDai - https://www.xdaichain.com/ (also see https://docs.tokenbridge.net/)
 */

contract L2_XDaiBridge is L2_Bridge {
    iArbitraryMessageBridge public messenger;
    /// @notice The xDai AMB uses bytes32 for chainId instead of uint256
    bytes32 public l1ChainId;

    constructor (
        iArbitraryMessageBridge _messenger,
        address l1Governance,
        HopBridgeToken hToken,
        IERC20 l2CanonicalToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address[] memory bonders,
        uint256 _l1ChainId
    )
        public
        L2_Bridge(
            l1Governance,
            hToken,
            l2CanonicalToken,
            l1BridgeAddress,
            supportedChainIds,
            bonders
        )
    {
        messenger = _messenger;
        l1ChainId = bytes32(_l1ChainId);
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        messenger.requireToPassMessage(
            l1BridgeAddress,
            message,
            messengerGasLimit
        );
    }

    function _verifySender(address expectedSender) internal override {
        require(messenger.messageSender() == expectedSender);
        require(msg.sender == address(messenger));

        // With the xDai AMB, it is best practice to also check the source chainId
        // https://docs.tokenbridge.net/amb-bridge/how-to-develop-xchain-apps-by-amb#receive-a-method-call-from-the-amb-bridge
        require(messenger.messageSourceChainId() == l1ChainId);
    }

    /**
     * @dev Allows the L1 Bridge to set the messenger
     * @param _messenger The new messenger address
     */
    function setMessenger(iArbitraryMessageBridge _messenger) external onlyL1Bridge {
        messenger = _messenger;
    }
}

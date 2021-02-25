// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/xDai/messengers/iArbitraryMessageBridge.sol";
import "./L2_Bridge.sol";

contract L2_XDaiBridge is L2_Bridge {
    iArbitraryMessageBridge public messenger;
    /// @notice The xDai AMB uses bytes32 for chainId instead of uint256
    bytes32 public l1ChainId;

    constructor (
        iArbitraryMessageBridge _messenger,
        address l1Governance,
        IERC20 canonicalToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address[] memory bonders,
        address exchangeAddress,
        string memory name,
        string memory symbol,
        uint8 decimals,
        bytes32 _l1ChainId
    )
        public
        L2_Bridge(
            l1Governance,
            canonicalToken,
            l1BridgeAddress,
            supportedChainIds,
            bonders,
            exchangeAddress,
            name,
            symbol,
            decimals
        )
    {
        messenger = _messenger;
        l1ChainId = _l1ChainId;
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

        // With the xDai AMB, it is best practice to also check the source chainId
        // https://docs.tokenbridge.net/amb-bridge/how-to-develop-xchain-apps-by-amb#receive-a-method-call-from-the-amb-bridge
        require(messenger.messageSourceChainId() == l1ChainId);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/optimism/messengers/iOVM_L2CrossDomainMessenger.sol";
import "./L2_Bridge.sol";

contract L2_OptimismBridge is L2_Bridge {
    iOVM_L2CrossDomainMessenger public messenger;

    constructor (
        iOVM_L2CrossDomainMessenger _messenger,
        address l1Governance,
        HopBridgeToken hToken,
        IERC20 l2CanonicalToken,
        bool l2CanonicalTokenIsWeth,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address exchangeAddress,
        address[] memory bonders
    )
        public
        L2_Bridge(
            l1Governance,
            hToken,
            l2CanonicalToken,
            l2CanonicalTokenIsWeth,
            l1BridgeAddress,
            supportedChainIds,
            exchangeAddress,
            bonders
        )
    {
        messenger = _messenger;
    }

    // TODO: Use a valid gasLimit
    function _sendCrossDomainMessage(bytes memory message) internal override {
        messenger.sendMessage(
            l1BridgeAddress,
            message,
            0
        );
    }

    function _verifySender(address expectedSender) internal override {
        // ToDo: verify sender with Optimism L2 messenger
        // sender should be l1BridgeAddress
    }
}

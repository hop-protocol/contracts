// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/arbitrum/messengers/IArbSys.sol";
import "./L2_Bridge.sol";

contract L2_ArbitrumBridge is L2_Bridge {
    IArbSys public messenger;

    constructor (
        IArbSys _messenger,
        address l1Governance,
        HopBridgeToken hToken,
        IERC20 canonicalToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address exchangeAddress,
        address[] memory bonders
    )
        public
        L2_Bridge(
            l1Governance,
            hToken,
            canonicalToken,
            l1BridgeAddress,
            supportedChainIds,
            exchangeAddress,
            bonders
        )
    {
        messenger = _messenger;
    }

    function _sendCrossDomainMessage(bytes memory message) internal override {
        messenger.sendTxToL1(
            l1BridgeAddress,
            message
        );
    }

    function _verifySender(address expectedSender) internal override {
        // ToDo: verify sender with Arbitrum L2 messenger
        // sender should be l1BridgeAddress
    }
}

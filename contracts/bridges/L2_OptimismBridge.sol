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
        IERC20 canonicalToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address[] memory bonders,
        address exchangeAddress,
        string memory name,
        string memory symbol,
        uint8 decimals
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

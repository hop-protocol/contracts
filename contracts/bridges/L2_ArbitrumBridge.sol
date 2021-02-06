// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/arbitrum/messengers/IArbSys.sol";
import "./L2_Bridge.sol";

contract L2_ArbitrumBridge is L2_Bridge {
    IArbSys public messenger;

    constructor (
        IArbSys _messenger,
        address _l1Governance,
        IERC20 _canonicalToken,
        address _l1BridgeAddress,
        uint256[] memory _supportedChainIds,
        address _bonder,
        address _exchangeAddress
    )
        public
        L2_Bridge(_l1Governance, _canonicalToken, _l1BridgeAddress, _supportedChainIds, _bonder, _exchangeAddress)
    {
        messenger = _messenger;
    }

    function _sendCrossDomainMessage(bytes memory _message) internal override {
        messenger.sendTxToL1(
            l1BridgeAddress,
            _message
        );
    }

    function _verifySender(address _expectedSender) internal override {
        // ToDo: verify sender with Arbitrum L2 messenger
        // sender should be l1BridgeAddress
    }
}

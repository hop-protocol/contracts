// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/arbitrum/messengers/IArbSys.sol";
import "./L2_Bridge.sol";

/**
 * @dev An L2_Bridge for Arbitrum - https://developer.offchainlabs.com/
 */

contract L2_ArbitrumBridge is L2_Bridge {
    IArbSys public messenger;

    constructor (
        IArbSys _messenger,
        address l1Governance,
        HopBridgeToken hToken,
        address l1BridgeAddress,
        uint256[] memory activeChainIds,
        address[] memory bonders
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
        // See https://github.com/OffchainLabs/arbitrum/blob/new-rollup/packages/arb-bridge-peripherals/contracts/tokenbridge/arbitrum/ArbTokenBridge.sol#L107
    }

    /**
     * @dev Allows the L1 Bridge to set the messenger
     * @param _messenger The new messenger address
     */
    function setMessenger(IArbSys _messenger) external onlyGovernance {
        messenger = _messenger;
    }
}

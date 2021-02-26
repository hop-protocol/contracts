// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_XDaiBridge.sol";

contract Mock_L2_XDaiBridge is L2_XDaiBridge {
    uint256 private chainId;

    constructor (
        iArbitraryMessageBridge messenger,
        bytes32 l1ChainId,
        address l1Governance,
        HopBridgeToken hToken,
        IERC20 canonicalToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address exchangeAddress,
        address[] memory bonders
    )
        public
        L2_XDaiBridge(
            messenger,
            l1ChainId,
            l1Governance,
            hToken,
            canonicalToken,
            l1BridgeAddress,
            supportedChainIds,
            exchangeAddress,
            bonders
        )
    {
        chainId = 77;
    }

    function getChainId() public override view returns (uint256) {
        return chainId;
    }
}

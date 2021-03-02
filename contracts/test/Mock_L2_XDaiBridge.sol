// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_XDaiBridge.sol";

contract Mock_L2_XDaiBridge is L2_XDaiBridge {
    uint256 private chainId;

    constructor (
        uint256 _chainId,
        iArbitraryMessageBridge messenger,
        address l1Governance,
        HopBridgeToken hToken,
        IERC20 l2CanonicalToken,
        bool l2CanonicalTokenIsWeth,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address exchangeAddress,
        address[] memory bonders,
        bytes32 l1ChainId
    )
        public
        L2_XDaiBridge(
            messenger,
            l1Governance,
            hToken,
            l2CanonicalToken,
            l2CanonicalTokenIsWeth,
            l1BridgeAddress,
            supportedChainIds,
            exchangeAddress,
            bonders,
            l1ChainId
        )
    {
        chainId = _chainId;
    }

    function getChainId() public override view returns (uint256) {
        return chainId;
    }
}

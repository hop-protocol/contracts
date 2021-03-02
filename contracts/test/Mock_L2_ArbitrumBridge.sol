// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_ArbitrumBridge.sol";

contract Mock_L2_ArbitrumBridge is L2_ArbitrumBridge {
    uint256 private chainId;

    constructor (
        uint256 _chainId,
        IArbSys messenger,
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
        L2_ArbitrumBridge(
            messenger,
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
        chainId = _chainId;
    }

    function getChainId() public override view returns (uint256) {
        return chainId;
    }
}

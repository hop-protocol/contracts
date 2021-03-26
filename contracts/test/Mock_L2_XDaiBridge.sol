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
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address[] memory bonders,
        uint256 l1ChainId
    )
        public
        L2_XDaiBridge(
            messenger,
            l1Governance,
            hToken,
            l2CanonicalToken,
            l1BridgeAddress,
            supportedChainIds,
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

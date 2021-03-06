// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_OptimismBridge.sol";

contract Mock_L2_OptimismBridge is L2_OptimismBridge {
    uint256 private chainId;

    constructor (
        uint256 _chainId,
        iOVM_L2CrossDomainMessenger messenger,
        address l1Governance,
        HopBridgeToken hToken,
        IERC20 l2CanonicalToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address[] memory bonders,
        uint32 defaultGasLimit
    )
        public
        L2_OptimismBridge(
            messenger,
            l1Governance,
            hToken,
            l2CanonicalToken,
            l1BridgeAddress,
            supportedChainIds,
            bonders,
            defaultGasLimit
        )
    {
        chainId = _chainId;
    }

    function getChainId() public override view returns (uint256) {
        return chainId;
    }
}

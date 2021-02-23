// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../bridges/L2_XDaiBridge.sol";

contract Mock_L2_XDaiBridge is L2_XDaiBridge {
    uint256 private _chainId;

    constructor (
        iArbitraryMessageBridge _messenger,
        address l1Governance,
        IERC20 canonicalToken,
        address l1BridgeAddress,
        uint256[] memory supportedChainIds,
        address[] memory bonders,
        address exchangeAddress,
        string memory name,
        string memory symbol,
        uint8 decimals,
        bytes32 _l1ChainId
    )
        public
        L2_XDaiBridge(
            _messenger,
            l1Governance,
            canonicalToken,
            l1BridgeAddress,
            supportedChainIds,
            bonders,
            exchangeAddress,
            name,
            symbol,
            decimals,
            _l1ChainId
        )
    {
        _chainId = 77;
    }

    function getChainId() public override view returns (uint256) {
        return _chainId;
    }
}

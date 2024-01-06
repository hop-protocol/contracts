// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./L2_Bridge.sol";

contract L2_PolygonzkBridge is L2_Bridge {

    // Name remains the same for offchain backwards compatibility, but should be renamed to connector in future deployments
    address public immutable messenger;

    constructor (
        address _messenger,
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
        (bool success,) = messenger.call(message);
        require(success, "L2_PLY_ZK_BRG: Call to messenger failed");
    }

    function _verifySender(address expectedSender) internal override {
        require(msg.sender == expectedSender, "L2_PLY_ZK_BRG: Caller is not the expected sender");
    }
}

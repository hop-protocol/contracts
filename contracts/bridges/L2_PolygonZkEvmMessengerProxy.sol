// SPDX-License-Identifier: MIT
// @unsupported: ovm

pragma solidity 0.8.9;
pragma experimental ABIEncoderV2;

import "../polygon/ReentrancyGuard.sol";
import "../interfaces/polygonzkevm/messengers/IL2PolygonZkEvmMessenger.sol";
import "../interfaces/polygonzkevm/bridges/IBridgeMessageReceiver.sol";

contract L2Bridge {
    function commitTransfers(uint256 destinationChainId) external {}
}

contract L2_PolygonZkEvmMessengerProxy is IBridgeMessageReceiver, ReentrancyGuard {
    address public l2Bridge;
    address public l1Bridge;
    address public xDomainMessageSender;
    address public polygonZkEvmMessenger;
    bool private canCommit = false;

    address constant public DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    modifier onlyL2Bridge {
        require(msg.sender == l2Bridge, "L2_PLGNZK_MSG: Sender must be the L2 Bridge");
        _;
    }

    modifier validateSender(address sender) {
        require(sender == msg.sender, "L2_PLGNZK_MSG: Invalid sender");
        _;
    }

    constructor(address _l1Bridge, address _polygonZkEvmMessenger) public {
        l1Bridge = _l1Bridge;
        polygonZkEvmMessenger = _polygonZkEvmMessenger;
        xDomainMessageSender = DEAD_ADDRESS;
    }

    function setL2Bridge(address _l2Bridge) external {
        require(l2Bridge == address(0), "L2_PLGNZK_MSG: L2 Bridge already set");
        l2Bridge = _l2Bridge;
    }

    function commitTransfers(uint256 destinationChainId) external {
        require(msg.sender == tx.origin, "L2_PLGNZK_MSG: Sender must be origin");
        canCommit = true;
        L2Bridge(l2Bridge).commitTransfers(destinationChainId);
        canCommit = false;
    }

    function sendCrossDomainMessage(bytes memory message) external onlyL2Bridge {
        require(canCommit, "L2_PLGNZK_MSG: Unable to commit");
        uint32 destinationNetwork = 0;
        bool forceUpdateGlobalExitRoot = true;
        IL2PolygonZkEvmMessenger(polygonZkEvmMessenger).bridgeMessage{value: 0}(
          destinationNetwork,
          l1Bridge,
          forceUpdateGlobalExitRoot,
          message
        );
    }

    function onMessageReceived(
        address originAddress,
        uint32, /* originNetwork */
        bytes memory data
    )
        external
        override
        payable
        validateSender(originAddress)
        nonReentrant
    {
        xDomainMessageSender = originAddress;
        (bool success,) = l2Bridge.call(data);
        require(success, "L2_PLGNZK_MSG: Failed to proxy message");
        xDomainMessageSender = DEAD_ADDRESS;
    }
}
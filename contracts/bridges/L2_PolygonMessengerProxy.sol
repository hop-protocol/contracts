// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./L2_PolygonBridge.sol";
import "../interfaces/polygon/IStateReceiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract L2_PolygonMessengerProxy is IStateReceiver, ReentrancyGuard {

    L2_PolygonBridge public l2Bridge;
    address public polygonMessenger;
    address public xDomainMessageSender;

    address constant public DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    constructor(
        L2_PolygonBridge _l2Bridge,
        address _polygonMessenger
    ) public {
        l2Bridge = _l2Bridge;
        polygonMessenger = _polygonMessenger;
        xDomainMessageSender = DEAD_ADDRESS;
    }

    function onStateReceive(uint256 /*stateId*/, bytes calldata data) external override nonReentrant {
        require(msg.sender == polygonMessenger, "L2_PLGN_MSG: Caller is not polygon messenger");

        (address sender, bytes memory message) = abi.decode(data, (address, bytes));
        xDomainMessageSender = sender;
        (bool success,) = address(l2Bridge).call(message);
        require(success, "L2_PLGN_MSG: Failed to proxy message");
        xDomainMessageSender = DEAD_ADDRESS;
    }
}
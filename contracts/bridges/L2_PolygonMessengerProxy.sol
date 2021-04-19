// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../polygon/tunnel/BaseChildTunnel.sol";

contract L2_PolygonMessengerProxy is BaseChildTunnel, ReentrancyGuard {

    address public l2Bridge;
    address public xDomainMessageSender;

    address constant public DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    modifier onlyL2Bridge {
        require(msg.sender == l2Bridge, "L2_PLGN_MSG: Sender must be the L2 Bridge");
        _;
    }

    constructor() public {
        xDomainMessageSender = DEAD_ADDRESS;
    }

    function setL2Bridge(address _l2Bridge) external {
        require(l2Bridge == address(0), "L2_PLGN_MSG: L2 Bridge already set");
        l2Bridge = _l2Bridge;
    }

    function sendCrossDomainMessage(bytes memory message) external onlyL2Bridge {
        _sendMessageToRoot(message);
    }

    function _processMessageFromRoot(bytes memory data) internal override nonReentrant {
        (address sender, bytes memory message) = abi.decode(data, (address, bytes));
        xDomainMessageSender = sender;
        (bool success,) = l2Bridge.call(message);
        require(success, "L2_PLGN_MSG: Failed to proxy message");
        xDomainMessageSender = DEAD_ADDRESS;
    }
}
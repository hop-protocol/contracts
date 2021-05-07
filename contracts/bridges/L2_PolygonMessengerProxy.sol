// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../polygon/tunnel/FxBaseChildTunnel.sol";

contract L2_PolygonMessengerProxy is FxBaseChildTunnel, ReentrancyGuard {

    address public l2Bridge;
    address public xDomainMessageSender;

    address constant public DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    modifier onlyL2Bridge {
        require(msg.sender == l2Bridge, "L2_PLGN_MSG: Sender must be the L2 Bridge");
        _;
    }

    constructor(
        address _fxChild,
        address _fxRootTunnel
    )
        public
        FxBaseChildTunnel(_fxChild)
    {
        xDomainMessageSender = DEAD_ADDRESS;
        setFxRootTunnel(_fxRootTunnel);
    }

    function setL2Bridge(address _l2Bridge) external {
        require(l2Bridge == address(0), "L2_PLGN_MSG: L2 Bridge already set");
        l2Bridge = _l2Bridge;
    }

    function sendCrossDomainMessage(bytes memory message) external onlyL2Bridge {
        _sendMessageToRoot(message);
    }

    function _processMessageFromRoot(
        uint256 stateId,
        address sender,
        bytes memory data
    )
        internal
        override
        validateSender(sender)
        nonReentrant
    {
        // TODO: This might be (address sender, address receiver, bytes memory message)
        (address sender, bytes memory message) = abi.decode(data, (address, address, bytes));
        xDomainMessageSender = sender;
        (bool success,) = l2Bridge.call(message);
        require(success, "L2_PLGN_MSG: Failed to proxy message");
        xDomainMessageSender = DEAD_ADDRESS;
    }
}
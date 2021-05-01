// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/polygon/messengers/IPolygonMessengerWrapper.sol";
import "../interfaces/polygon/messengers/I_L2_PolygonMessengerProxy.sol";

import "./BytesLib.sol";

abstract contract MockMessenger {
    using SafeERC20 for IERC20;
    using BytesLib for bytes;

    struct Message {
        address target;
        bytes message;
        address sender;
    }

    Message public nextMessage;
    IERC20 public canonicalToken;
    bool public isPolygonL1;
    bool public isPolygonL2;

    /**
     * Chain specific params
     */

    // Optimism
    address public xDomainMessageSender;

    // XDai
    address public messageSender;
    bytes32 public messageSourceChainId = 0x000000000000000000000000000000000000000000000000000000000000002a;

    constructor(IERC20 _canonicalToken) public {
        canonicalToken = _canonicalToken;
    }

    function setIsPolygonL1(bool _isPolygonL1) public {
        isPolygonL1 = _isPolygonL1;
    }

    function setIsPolygonL2(bool _isPolygonL2) public {
        isPolygonL2 = _isPolygonL2;
    }

    function relayNextMessage() public {
        messageSender = nextMessage.sender;
        xDomainMessageSender = nextMessage.sender;

        if (isPolygonL1) {
            IPolygonMessengerWrapper(nextMessage.target).processMessageFromChild(nextMessage.message);
        } else if (isPolygonL2) {
            // This is required because Polygon has a "messenger" for each token and not a generalized messenger
            if (nextMessage.target == address(canonicalToken)) {
                (bool success, bytes memory res) = nextMessage.target.call(nextMessage.message);
                require(success, _getRevertMsgFromRes(res));
            } else {
                I_L2_PolygonMessengerProxy(nextMessage.target).processMessageFromRoot(nextMessage.message);
            }
        } else {
            (bool success, bytes memory res) = nextMessage.target.call(nextMessage.message);
            require(success, _getRevertMsgFromRes(res));
        }
    }

    function receiveMessage(
        address _target,
        bytes memory _message,
        address _sender
    )
        public
    {
        nextMessage = Message(
            _target,
            _message,
            _sender
        );
    }

    function _getRevertMsgFromRes(bytes memory _res) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_res.length < 68) return 'BA: Transaction reverted silently';
        bytes memory revertData = _res.slice(4, _res.length - 4); // Remove the selector which is the first 4 bytes
        return abi.decode(revertData, (string)); // All that remains is the revert string
    }
}

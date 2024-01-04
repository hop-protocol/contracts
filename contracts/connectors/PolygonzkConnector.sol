// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/polygonzk/messengers/IPolygonZkEVMBridge.sol";
import "../shared/Initializable.sol";

contract PolygonzkConnector is Initializable {

    address public target;
    address public counterpart;
    uint32 public counterpartNetwork;
    address public messengerAddress;

    bool public constant FORCE_UPDATE_GLOBAL_EXIT_ROOT = false;

    function initialize(
        address _target,
        address _counterpart,
        uint32 _counterpartNetwork,
        address _messengerAddress
    ) public initializer {
        target = _target;
        counterpart = _counterpart;
        counterpartNetwork = _counterpartNetwork;
        messengerAddress = _messengerAddress;
    }

    function dispatchCrossDomainMessage(bytes memory message) external {
        _dispatchCrossDomainMessage(message);
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external {
        require(originAddress == counterpart, "PLY_ZK_CNR: Origin address does not match counterpart address");
        require(originNetwork == counterpartNetwork, "PLY_ZK_CNR: Origin network does not match counterpart network");
        require(msg.sender == messengerAddress, "PLY_ZK_CNR: Caller is not the messenger");

        (bool success,) = target.call(data);
        require(success, "PLY_ZK_CNR: Call to targetReceiver failed");
    }

    /* ========== Internal functions ========== */

    function _dispatchCrossDomainMessage (bytes memory message) internal {
        require(msg.sender == target, "PLY_ZK_CNR: Caller is not the expected sender");
        IPolygonZkEVMBridge(messengerAddress).bridgeMessage(
            counterpartNetwork,
            counterpart,
            FORCE_UPDATE_GLOBAL_EXIT_ROOT,
            message
        );
    }
}


// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/polygonzk/messengers/IPolygonZkEVMBridge.sol";
import "./Connector.sol";

contract PolygonzkConnector is Connector {

    uint32 public counterpartNetwork;
    address public messengerAddress;

    function initialize(
        address target,
        address counterpart,
        uint32 _counterpartNetwork,
        address _messengerAddress
    ) external {
        initialize(target, counterpart);

        counterpartNetwork = _counterpartNetwork;
        messengerAddress = _messengerAddress;
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external {
        require(originAddress == counterpart, "PLY_ZK_CNR: Origin address does not match counterpart address");
        require(originNetwork == counterpartNetwork, "PLY_ZK_CNR: Origin network does not match counterpart network");
        require(msg.sender == messengerAddress, "PLY_ZK_CNR: Caller is not the messenger");

        uint256 value = 0;
        target.execute(data, value);
    }

    /* ========== Internal functions ========== */

    function _forwardCrossDomainMessage() internal override {
        _forwardCrossDomainMessage(msg.data);
    }

    function _forwardCrossDomainMessage(bytes memory data) internal {
        require(msg.sender == target, "PLY_ZK_CNR: Caller is not the expected sender");

        bool forceUpdateGlobalExitRoot = false;
        IPolygonZkEVMBridge(messengerAddress).bridgeMessage(
            counterpartNetwork,
            counterpart,
            forceUpdateGlobalExitRoot,
            data
        );
    }

    function _verifyCrossDomainSender() internal override {
        revert("BASE_PLY_ZK_CNR: _verifyCrossDomainSender() is handled by onMessageReceived");
    }
}


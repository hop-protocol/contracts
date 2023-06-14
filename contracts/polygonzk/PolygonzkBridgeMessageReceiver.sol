// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.6.12;

import '../interfaces/polygonzk/messengers/IBridgeMessageReceiver.sol';

interface PolygonzkBridgeMessageReceiver {
    address public immutable destinationBridge;
    address public immutable caller;
    address public immutable fromNetworkId;

    constructor(address _destinationBridge, address _caller, address _fromNetworkId ) public {
        destinationBridge = _destinationBridge;
        caller = _caller;
        fromNetworkId = _fromNetworkId;
    }

    function onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data
    ) external {
        require(msg.sender == caller, "PLY_ZK_BMR: Caller is not the messenger");
        require(fromNetworkId == originNetwork, "PLY_ZK_BMR: Origin network is not expected");

        (bool success,) = destinationBridge.call(data);
        require(success, "PLG_ZK_BMR: Call to bridge failed");
    }
}
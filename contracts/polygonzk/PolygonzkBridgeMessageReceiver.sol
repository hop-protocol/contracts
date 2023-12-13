// SPDX-License-Identifier: AGPL-3.0

pragma solidity 0.6.12;

import '../interfaces/polygonzk/bridges/IBridgeMessageReceiver.sol';

abstract contract PolygonzkBridgeMessageReceiver {
    address public xDomainMessageSender;
    uint256 public xDomainNetwork;

    address constant public DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    uint256 constant public DEFAULT_NETWORK = uint256(bytes32(keccak256("Default Network")));

    constructor () public {
        xDomainMessageSender = DEAD_ADDRESS;
        xDomainNetwork = DEFAULT_NETWORK;
    }

    function _onMessageReceived(
        address originAddress,
        uint32 originNetwork,
        bytes memory data,
        address targetAddress,
        address messengerAddress,
        address sourceChainSender,
        uint256 sourceChainNetwork
    ) internal {
        require(msg.sender == messengerAddress, "PLY_ZK_BRG_MR: Caller is not the messenger");
        require(originAddress == sourceChainSender, "PLY_ZK_BRG_MR: Origin address is not the expected sender");
        require(uint256(originNetwork) == sourceChainNetwork, "PLY_ZK_BRG_MR: Origin network is not expected");

        xDomainMessageSender = originAddress;
        xDomainNetwork = uint256(originNetwork);
        (bool success,) = targetAddress.call(data);
        require(success, "PLY_ZK_BRG_MR: Call to L1 Bridge failed");
        xDomainMessageSender = DEAD_ADDRESS;
        xDomainNetwork = DEFAULT_NETWORK;
    }
}
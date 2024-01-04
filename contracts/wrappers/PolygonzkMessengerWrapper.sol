// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./MessengerWrapper.sol";
import "../connectors/PolygonzkConnector.sol";

contract PolygonzkMessengerWrapper is MessengerWrapper, PolygonzkConnector {

    address public immutable l1Messenger;

    constructor(
        address _l1BridgeAddress,
        uint256 _l2ChainId,
        address _l1Messenger
    )
        public
        MessengerWrapper(_l1BridgeAddress, _l2ChainId)
        PolygonzkConnector()
    {
        l1Messenger = _l1Messenger;
    }

    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        _dispatchCrossDomainMessage(_calldata);
    }

    function verifySender(address l1BridgeCaller, bytes memory /*_data*/) public override {
        if (isRootConfirmation) return;

        require(l1BridgeCaller == l1Messenger, "PLGN_ZK_MSG_WRP: Caller is not the messenger");
        require(msg.sender == l1BridgeAddress, "PLGN_ZK_MSG_WRP: Sender is not the L1 Bridge");
    }
}

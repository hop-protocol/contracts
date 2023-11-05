// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/linea/messengers/IBridge.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for Linea - https://docs.linea.build/
 * @notice Deployed on layer-1
 */

contract LineaMessengerWrapper is MessengerWrapper {

    IBridge public lineaL1Bridge;
    address public l2BridgeAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IBridge _lineaL1Bridge,
        uint256 _l2ChainId
    )
        public
        MessengerWrapper(_l1BridgeAddress, _l2ChainId)
    {
        l2BridgeAddress = _l2BridgeAddress;
        lineaL1Bridge = _lineaL1Bridge;
    }

    /**
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        lineaL1Bridge.sendMessage(
            l2BridgeAddress,
            0,
            _calldata
        );
    }

    function verifySender(address l1BridgeCaller, bytes memory) public override {
        if (isRootConfirmation) return;

        require(lineaL1Bridge.sender() == l2BridgeAddress, "LINEA_MSG_WRP: Invalid cross-domain sender");
        require(l1BridgeCaller == address(lineaL1Bridge), "LINEA_MSG_WRP: Caller is not the expected sender");
    }
}

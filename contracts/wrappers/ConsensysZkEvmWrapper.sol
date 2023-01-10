// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/consensysZkEvm/messengers/IBridge.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for the ConsenSys zkEVM - https://consensys.net/docs/zk-evm/en/latest/
 * @notice Deployed on layer-1
 */

contract ConsensysZkEvmWrapper is MessengerWrapper {

    IBridge public consensysL1BridgeAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IBridge _consensysL1BridgeAddress,
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        consensysL1BridgeAddress = _consensysL1BridgeAddress
    }

    /**
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        consensysL1BridgeAddress.dispatchMessage(
            l2BridgeAddress,
            0,
            9999999999, // Unlimited deadline
            _calldata
        );
    }


    function verifySender(address l1BridgeCaller, bytes memory) public override {
        require(consensysL1BridgeAddress.sender() == l2BridgeAddress, "L1_CSYS_MSG_WRP: Invalid cross-domain sender");
        require(l1BridgeCaller == consensysL1BridgeAddress, "L1_CSYS_MSG_WRP: Caller is not the expected sender");
    }
}

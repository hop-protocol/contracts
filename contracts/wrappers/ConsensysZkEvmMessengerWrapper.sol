// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/consensys/messengers/IBridge.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for the ConsenSys zkEVM - https://consensys.net/docs/zk-evm/en/latest/
 * @notice Deployed on layer-1
 */

contract ConsensysZkEvmMessengerWrapper is MessengerWrapper {

    IBridge public consensysL1Bridge;
    address public l2BridgeAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IBridge _consensysL1Bridge
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        consensysL1Bridge = _consensysL1Bridge;
    }

    receive() external payable {}

    /**
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        uint256 fee = 1 ether;
        consensysL1Bridge.dispatchMessage{value: fee}(
            l2BridgeAddress,
            0,
            9999999999, // Unlimited deadline
            _calldata
        );
    }


    function verifySender(address l1BridgeCaller, bytes memory) public override {
        require(consensysL1Bridge.sender() == l2BridgeAddress, "L1_CSYS_MSG_WRP: Invalid cross-domain sender");
        require(l1BridgeCaller == address(consensysL1Bridge), "L1_CSYS_MSG_WRP: Caller is not the expected sender");
    }

}

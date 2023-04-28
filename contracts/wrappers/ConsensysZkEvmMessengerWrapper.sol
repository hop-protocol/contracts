// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/consensys/messengers/IBridge.sol";
import "../MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for the ConsenSys zkEVM - https://consensys.net/docs/zk-evm/en/latest/
 * @notice Deployed on layer-1
 */

contract ConsensysZkEvmMessengerWrapper is MessengerWrapper, Ownable {

    IBridge public consensysL1Bridge;
    address public l2BridgeAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IBridge _consensysL1Bridge,
        uint256 _l2ChainId
    )
        public
        MessengerWrapper(_l1BridgeAddress, _l2ChainId)
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
        uint256 fee = consensysL1Bridge.minimumFee(); 
        consensysL1Bridge.dispatchMessage{value: fee}(
            l2BridgeAddress,
            fee,
            9999999999, // Unlimited deadline
            _calldata
        );
    }


    function verifySender(address l1BridgeCaller, bytes memory) public override {
        if (isRootConfirmation) return;

        require(consensysL1Bridge.sender() == l2BridgeAddress, "L1_CSYS_MSG_WRP: Invalid cross-domain sender");
        require(l1BridgeCaller == address(consensysL1Bridge), "L1_CSYS_MSG_WRP: Caller is not the expected sender");
    }

    /**
     * @dev Claim excess funds
     * @param recipient The recipient to send to
     * @param amount The amount to claim
     */
    function claimFunds(address payable recipient, uint256 amount) public onlyOwner {
        recipient.transfer(amount);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/scroll/messengers/IScrollMessenger.sol";
import "./MessengerWrapper.sol";

/**
 * @dev A MessengerWrapper for the Scroll zkEVM - https://scroll.io/alpha
 * @notice Deployed on layer-1
 */

contract ScrollZkEvmMessengerWrapper is MessengerWrapper, Ownable {

    IScrollMessenger public scrollL1Bridge;
    address public l2BridgeAddress;

    constructor(
        address _l1BridgeAddress,
        address _l2BridgeAddress,
        IScrollMessenger _scrollL1Bridge
    )
        public
        MessengerWrapper(_l1BridgeAddress)
    {
        l2BridgeAddress = _l2BridgeAddress;
        scrollL1Bridge = _scrollL1Bridge;
    }

    receive() external payable {}

    /**
     * @dev Sends a message to the l2BridgeAddress from layer-1
     * @param _calldata The data that l2BridgeAddress will be called with
     */
    function sendCrossDomainMessage(bytes memory _calldata) public override onlyL1Bridge {
        uint256 fee = 0.01 ether; // TODO: fetch fee
        uint256 gasLimit = 500000; // TODO: determine appropriate gas limit
        scrollL1Bridge.sendMessage{value: fee}(
            l2BridgeAddress,
            0, // value
            _calldata,
            gasLimit
        );
    }


    function verifySender(address l1BridgeCaller, bytes memory) public override {
        require(scrollL1Bridge.xDomainMessageSender() == l2BridgeAddress, "L1_SCRL_MSG_WRP: Invalid cross-domain sender");
        require(l1BridgeCaller == address(scrollL1Bridge), "L1_SCRL_MSG_WRP: Caller is not the expected sender");
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
